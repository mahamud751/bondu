import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(private db: PrismaService, private jwt: JwtService, private config: ConfigService) {}
  async sendOtp(phone: string, purpose: OtpPurpose) {
    const recent = await this.db.otpCode.count({ where: { phone, purpose, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
    if (recent >= 5) throw new HttpException('Too many OTP requests', HttpStatus.TOO_MANY_REQUESTS);
    const code = randomInt(100000, 1000000).toString();
    await this.db.otpCode.create({ data: { phone, purpose, codeHash: await argon2.hash(code), expiresAt: new Date(Date.now() + 5 * 60_000) } });
    // Production SMS adapter is called here once SMS_PROVIDER is configured.
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
    if (!user || !await argon2.verify(user.passwordHash, dto.password)) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');
    await this.db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.tokens(user.id, user.role, dto.deviceId ?? randomUUID(), dto.deviceName, meta);
  }
  async refresh(token: string, deviceId: string, meta: SessionMeta) {
    try {
      const payload = await this.jwt.verifyAsync(token, { secret: this.config.getOrThrow('JWT_REFRESH_SECRET') });
      const session = await this.db.deviceSession.findUnique({ where: { userId_deviceId: { userId: payload.sub, deviceId } } });
      if (!session || session.revokedAt || !await argon2.verify(session.refreshTokenHash, token)) throw new Error();
      return this.tokens(payload.sub, payload.role, deviceId, session.deviceName ?? undefined, meta);
    } catch { throw new UnauthorizedException('Invalid refresh token'); }
  }
  logout(userId: string, deviceId: string) { return this.db.deviceSession.updateMany({ where: { userId, deviceId }, data: { revokedAt: new Date() } }); }
  logoutAll(userId: string) { return this.db.deviceSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }); }
  devices(userId: string) { return this.db.deviceSession.findMany({ where: { userId }, select: { deviceId: true, deviceName: true, platform: true, lastUsedAt: true, revokedAt: true, createdAt: true } }); }
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
}
export type SessionMeta = { ipAddress?: string; userAgent?: string; platform?: string };
