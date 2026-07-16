import { Body, ConflictException, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role, StaffPermissionKey } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AllowSuspended } from '../common/decorators/account-state.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

class CreateAppealDto { @IsIn(['ACCOUNT','FEATURE_RESTRICTION','REPORT','REVIEW','VENDOR']) targetType!:string;@IsOptional()@IsUUID()targetId?:string;@IsString()@MinLength(20)@MaxLength(2000)reason!:string; }
class DecideAppealDto { @IsIn(['ACCEPTED','REJECTED','CLOSED'])status!:string;@IsString()@MinLength(10)@MaxLength(2000)resolution!:string; }

@ApiTags('Moderation appeals') @ApiBearerAuth() @UseGuards(JwtGuard) @AllowSuspended() @Controller('appeals')
export class AppealsController {
  constructor(private readonly db:PrismaService){}
  @Get() mine(@CurrentUser()user:{sub:string}){return this.db.moderationAppeal.findMany({where:{userId:user.sub},orderBy:{createdAt:'desc'},take:100})}
  @Post() async create(@CurrentUser()user:{sub:string},@Body()dto:CreateAppealDto){const open=await this.db.moderationAppeal.count({where:{userId:user.sub,status:'OPEN'}});if(open>=3)throw new ConflictException('Resolve an existing appeal before creating another');return this.db.moderationAppeal.create({data:{userId:user.sub,targetType:dto.targetType,targetId:dto.targetId,reason:dto.reason.trim()}})}
}

@ApiTags('Admin moderation appeals') @ApiBearerAuth() @UseGuards(JwtGuard,RolesGuard,PermissionsGuard) @Roles(Role.ADMIN,Role.MODERATOR) @RequirePermissions(StaffPermissionKey.MODERATE_CONTENT) @Controller('admin/appeals')
export class AdminAppealsController {
  constructor(private readonly db:PrismaService){}
  @Get() queue(){return this.db.moderationAppeal.findMany({where:{status:'OPEN'},orderBy:{createdAt:'asc'},take:250})}
  @Patch(':id') async decide(@Param('id')id:string,@Body()dto:DecideAppealDto,@CurrentUser()actor:{sub:string;role:string}){return this.db.$transaction(async tx=>{const appeal=await tx.moderationAppeal.findUniqueOrThrow({where:{id}});if(appeal.status!=='OPEN')throw new ConflictException('Appeal is already resolved');const result=await tx.moderationAppeal.update({where:{id},data:{status:dto.status,resolution:dto.resolution.trim(),reviewedBy:actor.sub,reviewedAt:new Date()}});await tx.notification.create({data:{userId:appeal.userId,type:'MODERATION_APPEAL',title:`Appeal ${dto.status.toLowerCase()}`,body:dto.resolution.trim().slice(0,240),data:{appealId:id}}});await tx.auditLog.create({data:{actorId:actor.sub,actorRole:actor.role,action:'MODERATION_APPEAL_DECIDED',entityType:'MODERATION_APPEAL',entityId:id,newValue:{status:dto.status,resolution:dto.resolution}}});return result})}
}
