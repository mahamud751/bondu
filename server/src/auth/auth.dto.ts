import { OtpPurpose } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
export class SendOtpDto { @Matches(/^01\d{9}$/) phone!: string; @IsEnum(OtpPurpose) purpose!: OtpPurpose; }
export class VerifyOtpDto extends SendOtpDto { @Matches(/^\d{6}$/) code!: string; }
export class RegisterDto {
  @ApiProperty({ example: '01700000000' }) @Matches(/^01\d{9}$/) phone!: string;
  @ApiProperty() @MinLength(8) password!: string;
  @ApiProperty() @IsString() @Length(3, 30) username!: string;
  @ApiProperty() @IsString() displayName!: string;
  @ApiProperty({ example: '2000-01-01' }) @IsDateString() dateOfBirth!: string;
  @ApiProperty() @IsBoolean() @Equals(true) termsAccepted!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() deviceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deviceName?: string;
}
export class LoginDto { @Matches(/^01\d{9}$/) phone!: string; @IsString() password!: string; @IsOptional() @IsString() deviceId?: string; @IsOptional() @IsString() deviceName?: string; }
export class RefreshDto { @IsString() refreshToken!: string; @IsString() deviceId!: string; }
export class LogoutDto { @IsString() deviceId!: string; }
export class ForgotPasswordDto { @Matches(/^01\d{9}$/) phone!: string; }
export class ResetPasswordDto { @Matches(/^01\d{9}$/) phone!: string; @Matches(/^\d{6}$/) code!: string; @MinLength(8) newPassword!: string; }
export class ChangePasswordDto { @IsString() currentPassword!: string; @MinLength(8) newPassword!: string; }
export class SendEmailCodeDto { @IsEmail() email!:string; @IsIn(['REGISTER','RESET_PASSWORD']) purpose!:'REGISTER'|'RESET_PASSWORD'; }
export class VerifyEmailCodeDto extends SendEmailCodeDto { @Matches(/^\d{6}$/) code!:string; }
export class EmailRegisterDto {
  @IsEmail() email!:string;
  @Matches(/^\d{6}$/) code!:string;
  @MinLength(8) password!:string;
  @IsString() @Length(3,30) username!:string;
  @IsString() @Length(2,100) displayName!:string;
  @IsDateString() dateOfBirth!:string;
  @IsBoolean() @Equals(true) termsAccepted!:boolean;
  @IsOptional() @IsString() deviceId?:string;
  @IsOptional() @IsString() deviceName?:string;
}
export class EmailLoginDto { @IsEmail() email!:string; @IsString() password!:string; @IsOptional() @IsString() deviceId?:string; @IsOptional() @IsString() deviceName?:string; }
export class EmailResetPasswordDto { @IsEmail() email!:string; @Matches(/^\d{6}$/) code!:string; @MinLength(8) newPassword!:string; }
export class ProviderLoginDto {
  @IsString() identityToken!:string;
  @IsString() nonce!:string;
  @IsOptional() @IsString() @Length(3,30) username?:string;
  @IsOptional() @IsString() @Length(2,100) displayName?:string;
  @IsOptional() @IsDateString() dateOfBirth?:string;
  @IsOptional() @IsBoolean() termsAccepted?:boolean;
  @IsOptional() @IsString() deviceId?:string;
  @IsOptional() @IsString() deviceName?:string;
}
