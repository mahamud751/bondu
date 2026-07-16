import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Role, StaffPermissionKey } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PrismaService } from '../prisma/prisma.service';
class ResolveRiskDto { @IsString() @MaxLength(1000) resolution!: string; }
@ApiTags('Fraud') @ApiBearerAuth() @UseGuards(JwtGuard, RolesGuard, PermissionsGuard) @Roles(Role.ADMIN, Role.FINANCE, Role.MODERATOR) @RequirePermissions(StaffPermissionKey.REVIEW_RISK) @Controller('admin/fraud')
export class FraudController {
  constructor(private readonly db: PrismaService) {}
  @Get() list() { return this.db.fraudAssessment.findMany({ orderBy: { createdAt: 'desc' }, take: 250 }); }
  @Patch(':id/resolve') resolve(@Param('id') id: string, @Body() dto: ResolveRiskDto, @CurrentUser() actor: { sub: string }) { return this.db.fraudAssessment.update({ where: { id }, data: { resolution: dto.resolution, reviewedBy: actor.sub, reviewedAt: new Date() } }); }
}
