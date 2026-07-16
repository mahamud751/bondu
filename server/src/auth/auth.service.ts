import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHmac, randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailLoginDto, EmailRegisterDto, LoginDto, ProviderLoginDto, RegisterDto } from './auth.dto';
import { SmsService } from '../sms/sms.service';
import { ProviderAuthService } from './provider-auth.service';
import { EmailService } from '../notifications/email.service';

@Injectable()
export class AuthService {
  constructor(private db: PrismaService, private jwt: JwtService, private config: ConfigService,private readonly sms:SmsService,private readonly providers:ProviderAuthService,private readonly email:EmailService) {}
  async sendOtp(phone: string, purpose: OtpPurpose) {
    const recent = await this.db.otpCode.count({ where: { phone, purpose, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
    if (recent >= 5) throw new HttpException('Too many OTP requests', HttpStatus.TOO_MANY_REQUESTS);
    const code = randomInt(100000, 1000000).toString();
    await this.db.otpCode.create({ data: { phone, purpose, codeHash: await argon2.hash(code), expiresAt: new Date(Date.now() + 5 * 60_000) } });
    await this.sms.sendOtp(phone,code,5);
    return { sent: true, expiresInSeconds: 300, ...(this.config.get('NODE_ENV') === 'production' ? {} : { developmentCode: code }) };
  }
  async verifyOtp(phone: string, purpose: OtpPurpose, code: string) {
    const otp = await this.db.otpCode.findFirst({ where: { phone, purpose, consumedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!otp || otp.expiresAt < new Date()) throw new BadRequestException('OTP expired or not found');
    if (otp.attempts >= 5) throw new HttpException('OTP attempt limit reached', HttpStatus.TOO_MANY_REQUESTS);
    if (!await argon2.verify(otp.codeHash, code)) { await this.db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } }); throw new BadRequestException('Incorrect OTP'); }
    await this.db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    return { verified: true };
  }
  async sendEmailCode(rawEmail:string,purpose:'REGISTER'|'RESET_PASSWORD'){
    const email=rawEmail.trim().toLowerCase();
    const recent=await this.db.emailCode.count({where:{email,purpose,createdAt:{gt:new Date(Date.now()-10*60_000)}}});
    if(recent>=5)throw new HttpException('Too many email verification requests',HttpStatus.TOO_MANY_REQUESTS);
    const code=randomInt(100000,1000000).toString();
    await this.db.emailCode.create({data:{email,purpose,codeHash:await argon2.hash(code),expiresAt:new Date(Date.now()+10*60_000)}});
    if(this.email.configured())await this.email.send(email,purpose==='REGISTER'?'Verify your SocialConnect email':'Reset your SocialConnect password',`Your verification code is ${code}. It expires in 10 minutes. Never share this code.`);
    else if(this.config.get('NODE_ENV')==='production')throw new HttpException('Email delivery is unavailable',HttpStatus.SERVICE_UNAVAILABLE);
    return{sent:true,expiresInSeconds:600,...(this.config.get('NODE_ENV')==='production'?{}:{developmentCode:code})};
  }
  async verifyEmailCode(rawEmail:string,purpose:'REGISTER'|'RESET_PASSWORD',code:string){
    const email=rawEmail.trim().toLowerCase(),entry=await this.db.emailCode.findFirst({where:{email,purpose,consumedAt:null},orderBy:{createdAt:'desc'}});
    if(!entry||entry.expiresAt<new Date())throw new BadRequestException('Email code expired or not found');
    if(entry.attempts>=5)throw new HttpException('Email code attempt limit reached',HttpStatus.TOO_MANY_REQUESTS);
    if(!await argon2.verify(entry.codeHash,code)){await this.db.emailCode.update({where:{id:entry.id},data:{attempts:{increment:1}}});throw new BadRequestException('Incorrect email code')}
    await this.db.emailCode.update({where:{id:entry.id},data:{consumedAt:new Date()}});
    return{verified:true};
  }
  async emailRegister(dto:EmailRegisterDto,meta:SessionMeta){
    const email=dto.email.trim().toLowerCase();
    await this.verifyEmailCode(email,'REGISTER',dto.code);
    const birth=new Date(dto.dateOfBirth),age=new Date(Date.now()-birth.getTime()).getUTCFullYear()-1970;
    if(age<18)throw new BadRequestException('You must be at least 18 years old');
    try{const user=await this.db.user.create({data:{phone:`email:${randomUUID()}`,email,passwordHash:await argon2.hash(dto.password),dateOfBirth:birth,emailVerifiedAt:new Date(),termsAcceptedAt:new Date(),profile:{create:{username:dto.username.toLowerCase(),displayName:dto.displayName,languages:[],interests:[]}},wallet:{create:{}}}});return this.tokens(user.id,user.role,dto.deviceId??randomUUID(),dto.deviceName,meta)}catch{throw new ConflictException('Email or username is already registered')}
  }
  async emailLogin(dto:EmailLoginDto,meta:SessionMeta){
    const email=dto.email.trim().toLowerCase(),user=await this.db.user.findUnique({where:{email}}),identityHash=this.phoneHash(email),valid=Boolean(user&&await argon2.verify(user.passwordHash,dto.password));
    if(!valid){await this.db.loginAttempt.create({data:{userId:user?.id,phoneHash:identityHash,successful:false,riskLevel:'MEDIUM',reason:'INVALID_EMAIL_CREDENTIALS',ipAddress:meta.ipAddress,userAgent:meta.userAgent,deviceId:dto.deviceId}});throw new UnauthorizedException('Invalid credentials')}
    if(!user||user.status!=='ACTIVE')throw new UnauthorizedException('Account is not active');
    const sessions=await this.db.deviceSession.findMany({where:{userId:user.id,revokedAt:null},select:{deviceId:true,ipAddress:true},take:20}),newDevice=sessions.length>0&&!sessions.some(session=>session.deviceId===dto.deviceId),newIp=Boolean(meta.ipAddress&&sessions.length>0&&!sessions.some(session=>session.ipAddress===meta.ipAddress)),riskLevel=newDevice&&newIp?'HIGH':newDevice||newIp?'MEDIUM':'LOW';
    await this.db.loginAttempt.create({data:{userId:user.id,phoneHash:identityHash,successful:true,riskLevel,reason:[newDevice?'NEW_DEVICE':null,newIp?'NEW_IP':null].filter(Boolean).join(',')||null,ipAddress:meta.ipAddress,userAgent:meta.userAgent,deviceId:dto.deviceId}});
    if(riskLevel!=='LOW')await this.db.notification.create({data:{userId:user.id,type:'SUSPICIOUS_LOGIN',title:'New sign-in detected',body:'Your account was accessed from a new device or network. If this was not you, change your password and sign out all devices.',data:{riskLevel,newDevice,newIp,at:new Date().toISOString()}}});
    await this.db.user.update({where:{id:user.id},data:{lastLoginAt:new Date()}});
    return{...await this.tokens(user.id,user.role,dto.deviceId??randomUUID(),dto.deviceName,meta),security:{riskLevel,newDevice,newIp}};
  }
  async resetEmailPassword(rawEmail:string,code:string,newPassword:string){
    const email=rawEmail.trim().toLowerCase();await this.verifyEmailCode(email,'RESET_PASSWORD',code);const user=await this.db.user.findUnique({where:{email}});if(user)await this.db.$transaction([this.db.user.update({where:{id:user.id},data:{passwordHash:await argon2.hash(newPassword)}}),this.db.deviceSession.updateMany({where:{userId:user.id},data:{revokedAt:new Date()}})]);return{reset:true};
  }
  async register(dto: RegisterDto, meta: SessionMeta) {
    const verified = await this.db.otpCode.findFirst({ where: { phone: dto.phone, purpose: 'REGISTER', consumedAt: { gt: new Date(Date.now() - 15 * 60_000) } } });
    if (!verified) throw new BadRequestException('Verify the registration OTP first');
    const age = new Date(Date.now() - new Date(dto.dateOfBirth).getTime()).getUTCFullYear() - 1970;
    if (age < 18) throw new BadRequestException('You must be at least 18 years old');
    try {
      const user = await this.db.user.create({ data: { phone: dto.phone, passwordHash: await argon2.hash(dto.password), dateOfBirth: new Date(dto.dateOfBirth), phoneVerifiedAt: new Date(), termsAcceptedAt: new Date(), profile: { create: { username: dto.username.toLowerCase(), displayName: dto.displayName, languages: [], interests: [] } }, wallet: { create: {} } } });
      return this.tokens(user.id, user.role, dto.deviceId ?? randomUUID(), dto.deviceName, meta);
    } catch { throw new ConflictException('Phone or username is already registered'); }
  }
  async login(dto: LoginDto, meta: SessionMeta) {
    const user = await this.db.user.findUnique({ where: { phone: dto.phone } });
    const phoneHash=this.phoneHash(dto.phone),valid=Boolean(user&&await argon2.verify(user.passwordHash,dto.password));
    if (!valid) { const recent=await this.db.loginAttempt.count({where:{phoneHash,successful:false,createdAt:{gt:new Date(Date.now()-15*60_000)}}});await this.db.loginAttempt.create({data:{userId:user?.id,phoneHash,successful:false,riskLevel:recent>=4?'HIGH':'MEDIUM',reason:'INVALID_CREDENTIALS',ipAddress:meta.ipAddress,userAgent:meta.userAgent,deviceId:dto.deviceId}});if(user&&recent===4)await this.db.notification.create({data:{userId:user.id,type:'ACCOUNT_WARNING',title:'Repeated sign-in attempts',body:'Several unsuccessful attempts were made to access your account. Review your devices and change your password if this was not you.'}});throw new UnauthorizedException('Invalid credentials'); }
    if(!user)throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');
    const sessions=await this.db.deviceSession.findMany({where:{userId:user.id,revokedAt:null},select:{deviceId:true,ipAddress:true},take:20}),newDevice=sessions.length>0&&!sessions.some(session=>session.deviceId===dto.deviceId),newIp=Boolean(meta.ipAddress&&sessions.length>0&&!sessions.some(session=>session.ipAddress===meta.ipAddress)),riskLevel=newDevice&&newIp?'HIGH':newDevice||newIp?'MEDIUM':'LOW',reason=[newDevice?'NEW_DEVICE':null,newIp?'NEW_IP':null].filter(Boolean).join(',')||null;
    await this.db.loginAttempt.create({data:{userId:user.id,phoneHash,successful:true,riskLevel,reason,ipAddress:meta.ipAddress,userAgent:meta.userAgent,deviceId:dto.deviceId}});
    if(riskLevel!=='LOW')await this.db.notification.create({data:{userId:user.id,type:'SUSPICIOUS_LOGIN',title:'New sign-in detected',body:`Your account was accessed from ${newDevice?'a new device':'a new network'}. If this was not you, change your password and sign out all devices.`,data:{riskLevel,newDevice,newIp,at:new Date().toISOString()}}});
    await this.db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return {...await this.tokens(user.id, user.role, dto.deviceId ?? randomUUID(), dto.deviceName, meta),security:{riskLevel,newDevice,newIp}};
  }
  async refresh(token: string, deviceId: string, meta: SessionMeta) {
    try {
      const payload = await this.jwt.verifyAsync(token, { secret: this.config.getOrThrow('JWT_REFRESH_SECRET') });
      const session = await this.db.deviceSession.findUnique({ where: { userId_deviceId: { userId: payload.sub, deviceId } } });
      if (!session || session.revokedAt || !await argon2.verify(session.refreshTokenHash, token)) throw new Error();
      return this.tokens(payload.sub, payload.role, deviceId, session.deviceName ?? undefined, meta);
    } catch { throw new UnauthorizedException('Invalid refresh token'); }
  }
  oauthNonce(){return this.providers.issueNonce()}
  async providerLogin(provider:'GOOGLE'|'APPLE',dto:ProviderLoginDto,meta:SessionMeta){
    const identity=provider==='GOOGLE'?await this.providers.verifyGoogle(dto.identityToken,dto.nonce):await this.providers.verifyApple(dto.identityToken,dto.nonce);
    const linked=await this.db.authIdentity.findUnique({where:{provider_providerUserId:{provider,providerUserId:identity.subject}},include:{user:true}});
    let user=linked?.user??await this.db.user.findUnique({where:{email:identity.email}});
    if(!user){
      if(!dto.username||!dto.displayName||!dto.dateOfBirth||dto.termsAccepted!==true)throw new BadRequestException('Username, display name, date of birth and terms acceptance are required for a new account');
      const birth=new Date(dto.dateOfBirth),age=new Date(Date.now()-birth.getTime()).getUTCFullYear()-1970;if(age<18)throw new BadRequestException('You must be at least 18 years old');
      user=await this.db.user.create({data:{phone:`oauth:${provider.toLowerCase()}:${identity.subject}`,email:identity.email,passwordHash:await argon2.hash(randomUUID()),dateOfBirth:birth,emailVerifiedAt:new Date(),termsAcceptedAt:new Date(),profile:{create:{username:dto.username.toLowerCase(),displayName:dto.displayName,languages:[],interests:[]}},wallet:{create:{}}}});
    }
    if(linked)await this.db.authIdentity.update({where:{id:linked.id},data:{lastUsedAt:new Date(),email:identity.email}});else await this.db.authIdentity.create({data:{userId:user.id,provider,providerUserId:identity.subject,email:identity.email}});
    if(user.status!=='ACTIVE')throw new UnauthorizedException('Account is not active');await this.db.user.update({where:{id:user.id},data:{lastLoginAt:new Date(),emailVerifiedAt:user.emailVerifiedAt??new Date()}});return this.tokens(user.id,user.role,dto.deviceId??randomUUID(),dto.deviceName,meta);
  }
  logout(userId: string, deviceId: string) { return this.db.deviceSession.updateMany({ where: { userId, deviceId }, data: { revokedAt: new Date() } }); }
  logoutAll(userId: string) { return this.db.deviceSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }); }
  devices(userId: string) { return this.db.deviceSession.findMany({ where: { userId }, select: { deviceId: true, deviceName: true, platform: true, lastUsedAt: true, revokedAt: true, createdAt: true } }); }
  securityActivity(userId:string){return this.db.loginAttempt.findMany({where:{userId},select:{id:true,successful:true,riskLevel:true,reason:true,ipAddress:true,userAgent:true,deviceId:true,createdAt:true},orderBy:{createdAt:'desc'},take:100})}
  async resetPassword(phone: string, code: string, newPassword: string) {
    await this.verifyOtp(phone, 'RESET_PASSWORD', code);
    const user = await this.db.user.findUnique({ where: { phone } });
    if (user) {
      await this.db.$transaction([this.db.user.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(newPassword) } }), this.db.deviceSession.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } })]);
    }
    return { reset: true };
  }
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    if (!await argon2.verify(user.passwordHash, currentPassword)) throw new UnauthorizedException('Current password is incorrect');
    if (await argon2.verify(user.passwordHash, newPassword)) throw new BadRequestException('New password must be different');
    await this.db.$transaction([this.db.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(newPassword) } }), this.db.deviceSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })]);
    return { changed: true };
  }
  private async tokens(id: string, role: Role, deviceId: string, deviceName: string | undefined, meta: SessionMeta) {
    const payload = { sub: id, role, deviceId };
    const accessToken = await this.jwt.signAsync(payload, { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '15m' } as never);
    const refreshToken = await this.jwt.signAsync(payload, { secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), expiresIn: this.config.get('JWT_REFRESH_TTL') ?? '30d' } as never);
    const refreshTokenHash = await argon2.hash(refreshToken);
    await this.db.deviceSession.upsert({ where: { userId_deviceId: { userId: id, deviceId } }, create: { userId: id, deviceId, deviceName, refreshTokenHash, ...meta }, update: { deviceName, refreshTokenHash, ...meta, lastUsedAt: new Date(), revokedAt: null } });
    return { accessToken, refreshToken, deviceId };
  }
  private phoneHash(phone:string){return createHmac('sha256',this.config.getOrThrow<string>('JWT_REFRESH_SECRET')).update(phone).digest('hex')}
}
export type SessionMeta = { ipAddress?: string; userAgent?: string; platform?: string };
