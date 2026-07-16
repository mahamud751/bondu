import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role, StaffPermissionKey } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PrismaService } from '../prisma/prisma.service';
class TermDto { @IsString() @MinLength(2) @MaxLength(100) term!: string; @IsString() @MaxLength(50) category!: string; @IsOptional() @IsIn(['WARN', 'BLOCK']) severity?: string; }
class TermStatusDto { @IsBoolean() active!: boolean; }
@ApiTags('Moderation') @ApiBearerAuth() @UseGuards(JwtGuard, RolesGuard, PermissionsGuard) @Roles(Role.ADMIN, Role.MODERATOR) @RequirePermissions(StaffPermissionKey.MODERATE_CONTENT) @Controller('moderation')
export class ModerationController {
  constructor(private readonly db: PrismaService) {}
  @Get('blocked-terms') terms() { return this.db.blockedTerm.findMany({ orderBy: { term: 'asc' } }); }
  @Post('blocked-terms') create(@Body() dto: TermDto, @CurrentUser() actor: { sub: string;role:string }) { return this.db.$transaction(async tx=>{const term=await tx.blockedTerm.create({ data: { ...dto, term: dto.term.trim().toLowerCase(), createdBy: actor.sub } });await tx.auditLog.create({data:{actorId:actor.sub,actorRole:actor.role,action:'BLOCKED_TERM_CREATED',entityType:'BLOCKED_TERM',entityId:term.id,newValue:{term:term.term,category:term.category,severity:term.severity}}});return term}); }
  @Patch('blocked-terms/:id') status(@Param('id') id: string, @Body() dto: TermStatusDto,@CurrentUser() actor:{sub:string;role:string}) { return this.db.$transaction(async tx=>{const term=await tx.blockedTerm.update({ where: { id }, data: dto });await tx.auditLog.create({data:{actorId:actor.sub,actorRole:actor.role,action:'BLOCKED_TERM_STATUS_CHANGED',entityType:'BLOCKED_TERM',entityId:id,newValue:{active:term.active}}});return term}); }
  @Delete('blocked-terms/:id') remove(@Param('id') id: string,@CurrentUser() actor:{sub:string;role:string}) { return this.db.$transaction(async tx=>{const term=await tx.blockedTerm.delete({ where: { id } });await tx.auditLog.create({data:{actorId:actor.sub,actorRole:actor.role,action:'BLOCKED_TERM_DELETED',entityType:'BLOCKED_TERM',entityId:id,oldValue:{term:term.term,category:term.category,severity:term.severity}}});return term}); }
  @Get('events') events() { return this.db.moderationEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 250 }); }
}
