import { OtpPurpose } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsBoolean, IsDateString, IsEnum, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
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
