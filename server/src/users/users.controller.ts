import { Body, ConflictException, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import * as argon2 from 'argon2';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';
class ProfileDto {
  @IsOptional() @IsString() @MaxLength(80) displayName?: string;
  @IsOptional() @IsString() @MaxLength(500) bio?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() coverUrl?: string;
  @IsOptional() @IsString() @MaxLength(40) gender?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) languages?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) interests?: string[];
  @IsOptional() @IsString() @MaxLength(200) purpose?: string;
  @IsOptional() @IsString() @MaxLength(100) occupation?: string;
  @IsOptional() @IsString() @MaxLength(150) education?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) hobbies?: string[];
}
class BlockDto { @IsUUID() userId!: string; @IsOptional() @IsString() @MaxLength(300) reason?: string; }
class DeleteAccountDto { @IsString() password!: string; }
class PrivacyDto {
  @IsOptional() @IsBoolean() hideOnline?: boolean;
  @IsOptional() @IsBoolean() hideAge?: boolean;
  @IsOptional() @IsBoolean() hideLocation?: boolean;
  @IsOptional() @IsBoolean() discoverable?: boolean;
  @IsOptional() @IsBoolean() messagesFromEveryone?: boolean;
  @IsOptional() @IsBoolean() callsFromEveryone?: boolean;
}
@ApiTags('Users') @ApiBearerAuth() @UseGuards(JwtGuard) @Controller('users')
export class UsersController {
  constructor(private db: PrismaService) {}
  @Get('me') me(@CurrentUser() user: { sub: string }) { return this.db.user.findUnique({ where: { id: user.sub }, select: { id: true, phone: true, role: true, status: true, dateOfBirth: true, profile: true, vendor: true, createdAt: true } }); }
  @Patch('me/profile') profile(@CurrentUser() user: { sub: string }, @Body() dto: ProfileDto) { return this.db.profile.update({ where: { userId: user.sub }, data: dto }); }
  @Patch('me/privacy') privacy(@CurrentUser() user: { sub: string }, @Body() dto: PrivacyDto) { return this.db.profile.update({ where: { userId: user.sub }, data: dto }); }
  @Get('blocks') blocks(@CurrentUser() user: { sub: string }) { return this.db.block.findMany({ where: { blockerId: user.sub }, include: { blocked: { select: { profile: true } } }, orderBy: { createdAt: 'desc' } }); }
  @Post('blocks') block(@CurrentUser() user: { sub: string }, @Body() dto: BlockDto) {
    if (user.sub === dto.userId) throw new ConflictException('Cannot block yourself');
    return this.db.block.upsert({ where: { blockerId_blockedUserId: { blockerId: user.sub, blockedUserId: dto.userId } }, create: { blockerId: user.sub, blockedUserId: dto.userId, reason: dto.reason }, update: { reason: dto.reason } });
  }
  @Delete('blocks/:userId') unblock(@CurrentUser() user: { sub: string }, @Param('userId') blockedUserId: string) { return this.db.block.deleteMany({ where: { blockerId: user.sub, blockedUserId } }); }
  @Delete('me') async deleteAccount(@CurrentUser() current: { sub: string }, @Body() dto: DeleteAccountDto) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: current.sub }, include: { profile: true } });
    if (!await argon2.verify(user.passwordHash, dto.password)) throw new ConflictException('Password is incorrect');
    await this.db.$transaction([
      this.db.user.update({ where: { id: user.id }, data: { phone: `deleted:${user.id}`, email: null, status: 'DELETED', deletedAt: new Date(), refreshTokenHash: null } }),
      this.db.profile.update({ where: { userId: user.id }, data: { username: `deleted_${user.id.replaceAll('-', '')}`, displayName: 'Deleted user', bio: null, avatarUrl: null, coverUrl: null, city: null, languages: [], interests: [], hobbies: [], discoverable: false, online: false } }),
      this.db.deviceSession.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } }),
    ]);
    return { deleted: true };
  }
  @Get(':id') publicProfile(@Param('id') id: string) { return this.db.user.findUnique({ where: { id }, select: { id: true, role: true, profile: true, vendor: { select: { id: true, status: true, voiceRatePerMinute: true, paidChatRate: true, availableForCall: true, averageRating: true } } } }); }
}
