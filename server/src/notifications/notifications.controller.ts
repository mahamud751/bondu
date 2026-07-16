import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';
class PushTokenDto { @IsString() @MaxLength(512) token!: string; @IsString() @MaxLength(100) deviceId!: string; @IsIn(['ios', 'android']) platform!: string; }
class PreferenceDto { @IsOptional() @IsBoolean() pushEnabled?: boolean; @IsOptional() @IsBoolean() emailEnabled?: boolean; @IsOptional() @IsBoolean() smsSecurity?: boolean; @IsOptional() @IsArray() @IsString({ each: true }) mutedTypes?: string[]; @IsOptional() @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/) quietStart?: string; @IsOptional() @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/) quietEnd?: string; }
@ApiTags('Notifications') @ApiBearerAuth() @UseGuards(JwtGuard) @Controller('notifications')
export class NotificationsController {
  constructor(private readonly db: PrismaService) {}
  @Get() list(@CurrentUser() user: { sub: string }) { return this.db.notification.findMany({ where: { userId: user.sub }, orderBy: { createdAt: 'desc' }, take: 100 }); }
  @Patch(':id/read') read(@Param('id') id: string, @CurrentUser() user: { sub: string }) { return this.db.notification.updateMany({ where: { id, userId: user.sub }, data: { readAt: new Date() } }); }
  @Patch('read-all') readAll(@CurrentUser() user: { sub: string }) { return this.db.notification.updateMany({ where: { userId: user.sub, readAt: null }, data: { readAt: new Date() } }); }
  @Post('push-tokens') token(@CurrentUser() user: { sub: string }, @Body() dto: PushTokenDto) { return this.db.pushToken.upsert({ where: { userId_deviceId: { userId: user.sub, deviceId: dto.deviceId } }, create: { userId: user.sub, ...dto }, update: { token: dto.token, platform: dto.platform, active: true, lastUsedAt: new Date() } }); }
  @Delete('push-tokens/:deviceId') removeToken(@CurrentUser() user: { sub: string }, @Param('deviceId') deviceId: string) { return this.db.pushToken.updateMany({ where: { userId: user.sub, deviceId }, data: { active: false } }); }
  @Get('preferences') preferences(@CurrentUser() user: { sub: string }) { return this.db.notificationPreference.upsert({ where: { userId: user.sub }, create: { userId: user.sub }, update: {} }); }
  @Patch('preferences') updatePreferences(@CurrentUser() user: { sub: string }, @Body() dto: PreferenceDto) { return this.db.notificationPreference.upsert({ where: { userId: user.sub }, create: { userId: user.sub, ...dto }, update: dto }); }
}
