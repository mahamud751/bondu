import { Body, Controller, Get, Headers, Ip, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, LogoutDto, RefreshDto, RegisterDto, ResetPasswordDto, SendOtpDto, VerifyOtpDto } from './auth.dto';
import { AuthService } from './auth.service';
@ApiTags('Authentication') @Controller('auth') export class AuthController {
  constructor(private service: AuthService) {}
  private meta(ip:string,agent?:string,platform?:string){return{ipAddress:ip,userAgent:agent,platform}}
  @Post('send-otp') send(@Body() d:SendOtpDto){return this.service.sendOtp(d.phone,d.purpose)}
  @Post('verify-otp') verify(@Body()d:VerifyOtpDto){return this.service.verifyOtp(d.phone,d.purpose,d.code)}
  @Post('register') register(@Body() d:RegisterDto,@Ip()ip:string,@Headers('user-agent')ua?:string,@Headers('x-device-platform')p?:string){return this.service.register(d,this.meta(ip,ua,p))}
  @Post('login') login(@Body() d:LoginDto,@Ip()ip:string,@Headers('user-agent')ua?:string,@Headers('x-device-platform')p?:string){return this.service.login(d,this.meta(ip,ua,p))}
  @Post('refresh') refresh(@Body()d:RefreshDto,@Ip()ip:string,@Headers('user-agent')ua?:string){return this.service.refresh(d.refreshToken,d.deviceId,this.meta(ip,ua))}
  @Post('forgot-password') forgot(@Body() d: ForgotPasswordDto) { return this.service.sendOtp(d.phone, 'RESET_PASSWORD'); }
  @Post('reset-password') reset(@Body() d: ResetPasswordDto) { return this.service.resetPassword(d.phone, d.code, d.newPassword); }
  @ApiBearerAuth()@UseGuards(JwtGuard)@Post('change-password')change(@CurrentUser()u:{sub:string},@Body()d:ChangePasswordDto){return this.service.changePassword(u.sub,d.currentPassword,d.newPassword)}
  @ApiBearerAuth()@UseGuards(JwtGuard)@Post('logout')logout(@CurrentUser()u:{sub:string},@Body()d:LogoutDto){return this.service.logout(u.sub,d.deviceId)}
  @ApiBearerAuth()@UseGuards(JwtGuard)@Post('logout-all')logoutAll(@CurrentUser()u:{sub:string}){return this.service.logoutAll(u.sub)}
  @ApiBearerAuth()@UseGuards(JwtGuard)@Get('devices')devices(@CurrentUser()u:{sub:string}){return this.service.devices(u.sub)}
}
