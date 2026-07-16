import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role, StaffPermissionKey } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { EarningReleaseService } from './earning-release.service';
import { DurableJobsService } from './durable-jobs.service';

@ApiTags('Jobs') @ApiBearerAuth() @UseGuards(JwtGuard, RolesGuard, PermissionsGuard) @Roles(Role.ADMIN, Role.FINANCE) @RequirePermissions(StaffPermissionKey.MANAGE_FINANCE) @Controller('admin/jobs')
export class JobsController {
  constructor(private readonly earnings: EarningReleaseService,private readonly durable:DurableJobsService) {}
  @Post('release-earnings') releaseEarnings() { return this.earnings.releaseDue(500); }
  @Post('retry-failed') retryFailed(){return this.durable.retryFailed(100)}
  @Get('status') status(){return this.durable.status()}
}
