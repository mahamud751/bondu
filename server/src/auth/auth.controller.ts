import { Body, Controller, Get, Headers, Ip, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { ChangePasswordDto, EmailLoginDto, EmailRegisterDto, EmailResetPasswordDto, ForgotPasswordDto, LoginDto, LogoutDto, ProviderLoginDto, RefreshDto, RegisterDto, ResetPasswordDto, SendEmailCodeDto, SendOtpDto, VerifyEmailCodeDto, VerifyOtpDto } from './auth.dto';
import { AuthService } from './auth.service';
@ApiTags('Authentication') @Controller('auth') export class AuthController {
  constructor(private service: AuthService) {}
  private meta(ip:string,agent?:string,platform?:string){return{ipAddress:ip,userAgent:agent,platform}}
  @Throttle({ default: { limit: 5, ttl: 600_000 } }) @Post('send-otp') send(@Body() d:SendOtpDto){return this.service.sendOtp(d.phone,d.purpose)}
  @Throttle({ default: { limit: 10, ttl: 600_000 } }) @Post('verify-otp') verify(@Body()d:VerifyOtpDto){return this.service.verifyOtp(d.phone,d.purpose,d.code)}
  @Post('register') register(@Body() d:RegisterDto,@Ip()ip:string,@Headers('user-agent')ua?:string,@Headers('x-device-platform')p?:string){return this.service.register(d,this.meta(ip,ua,p))}
  @Throttle({default:{limit:5,ttl:600_000}})@Post('email/send-code')sendEmail(@Body()d:SendEmailCodeDto){return this.service.sendEmailCode(d.email,d.purpose)}
  @Throttle({default:{limit:10,ttl:600_000}})@Post('email/verify-code')verifyEmail(@Body()d:VerifyEmailCodeDto){return this.service.verifyEmailCode(d.email,d.purpose,d.code)}
  @Post('email/register')emailRegister(@Body()d:EmailRegisterDto,@Ip()ip:string,@Headers('user-agent')ua?:string,@Headers('x-device-platform')p?:string){return this.service.emailRegister(d,this.meta(ip,ua,p))}
  @Throttle({default:{limit:10,ttl:60_000}})@Post('email/login')emailLogin(@Body()d:EmailLoginDto,@Ip()ip:string,@Headers('user-agent')ua?:string,@Headers('x-device-platform')p?:string){return this.service.emailLogin(d,this.meta(ip,ua,p))}
  @Post('email/reset-password')resetEmail(@Body()d:EmailResetPasswordDto){return this.service.resetEmailPassword(d.email,d.code,d.newPassword)}
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) @Post('login') login(@Body() d:LoginDto,@Ip()ip:string,@Headers('user-agent')ua?:string,@Headers('x-device-platform')p?:string){return this.service.login(d,this.meta(ip,ua,p))}
  @Throttle({default:{limit:10,ttl:60_000}})@Post('oauth/nonce')nonce(){return this.service.oauthNonce()}
  @Throttle({default:{limit:10,ttl:60_000}})@Post('google')google(@Body()d:ProviderLoginDto,@Ip()ip:string,@Headers('user-agent')ua?:string,@Headers('x-device-platform')p?:string){return this.service.providerLogin('GOOGLE',d,this.meta(ip,ua,p))}
  @Throttle({default:{limit:10,ttl:60_000}})@Post('apple')apple(@Body()d:ProviderLoginDto,@Ip()ip:string,@Headers('user-agent')ua?:string,@Headers('x-device-platform')p?:string){return this.service.providerLogin('APPLE',d,this.meta(ip,ua,p))}
  @Post('refresh') refresh(@Body()d:RefreshDto,@Ip()ip:string,@Headers('user-agent')ua?:string){return this.service.refresh(d.refreshToken,d.deviceId,this.meta(ip,ua))}
  @Throttle({ default: { limit: 5, ttl: 600_000 } }) @Post('forgot-password') forgot(@Body() d: ForgotPasswordDto) { return this.service.sendOtp(d.phone, 'RESET_PASSWORD'); }
  @Post('reset-password') reset(@Body() d: ResetPasswordDto) { return this.service.resetPassword(d.phone, d.code, d.newPassword); }
  @ApiBearerAuth()@UseGuards(JwtGuard)@Post('change-password')change(@CurrentUser()u:{sub:string},@Body()d:ChangePasswordDto){return this.service.changePassword(u.sub,d.currentPassword,d.newPassword)}
  @ApiBearerAuth()@UseGuards(JwtGuard)@Post('logout')logout(@CurrentUser()u:{sub:string},@Body()d:LogoutDto){return this.service.logout(u.sub,d.deviceId)}
  @ApiBearerAuth()@UseGuards(JwtGuard)@Post('logout-all')logoutAll(@CurrentUser()u:{sub:string}){return this.service.logoutAll(u.sub)}
  @ApiBearerAuth()@UseGuards(JwtGuard)@Get('devices')devices(@CurrentUser()u:{sub:string}){return this.service.devices(u.sub)}
  @ApiBearerAuth()@UseGuards(JwtGuard)@Get('security-activity')activity(@CurrentUser()u:{sub:string}){return this.service.securityActivity(u.sub)}
}
