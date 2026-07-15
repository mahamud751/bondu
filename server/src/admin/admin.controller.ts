import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Prisma, ReportStatus, Role, UserStatus, VendorStatus, WithdrawalStatus } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
class SettingDto { @IsObject() value!: Record<string, unknown>; @IsOptional() @IsString() description?: string; }
class RoleDto { @IsEnum(Role) role!: Role; }
class UserStatusDto { @IsEnum(UserStatus) status!: UserStatus; }
class VendorStatusDto { @IsEnum(VendorStatus) status!: VendorStatus; @IsOptional() @IsString() reason?: string; }
class ReportStatusDto { @IsEnum(ReportStatus) status!: ReportStatus; }
class WithdrawalStatusDto { @IsEnum(WithdrawalStatus) status!: WithdrawalStatus; @IsOptional() @IsString() reason?: string; }
@ApiTags('Admin') @ApiBearerAuth() @UseGuards(JwtGuard, RolesGuard) @Roles(Role.ADMIN) @Controller('admin')
export class AdminController {
  constructor(private readonly db: PrismaService) {}
  @Get('dashboard') @Roles(Role.ADMIN, Role.MODERATOR, Role.FINANCE) async dashboard() {
    const [users, vendors, pendingPayments, pendingWithdrawals, openReports, revenue] = await Promise.all([
      this.db.user.count(), this.db.vendorProfile.count({ where: { status: 'APPROVED' } }),
      this.db.payment.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
      this.db.withdrawal.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
      this.db.report.count({ where: { status: 'OPEN' } }),
      this.db.walletLedger.aggregate({ where: { type: 'PLATFORM_COMMISSION' }, _sum: { amount: true } }),
    ]);
    return { users, approvedVendors: vendors, pendingPayments, pendingWithdrawals, openReports, platformRevenue: revenue._sum.amount ?? 0 };
  }
  @Get('settings') settings() { return this.db.setting.findMany({ orderBy: { key: 'asc' } }); }
  @Get('users') users() { return this.db.user.findMany({ select: { id: true, phone: true, role: true, status: true, createdAt: true, profile: true }, orderBy: { createdAt: 'desc' }, take: 200 }); }
  @Patch('settings/:key') async setting(@Param('key') key: string, @Body() dto: SettingDto, @CurrentUser() actor: { sub: string; role: string }) {
    const old = await this.db.setting.findUnique({ where: { key } });
    const value = dto.value as Prisma.InputJsonObject;
    const result = await this.db.setting.upsert({ where: { key }, create: { key, value, description: dto.description, updatedBy: actor.sub }, update: { value, description: dto.description, updatedBy: actor.sub } });
    await this.db.auditLog.create({ data: { actorId: actor.sub, actorRole: actor.role, action: 'SETTING_UPDATED', entityType: 'SETTING', entityId: key, oldValue: old?.value ?? undefined, newValue: value } });
    return result;
  }
  @Patch('users/:id/role') async role(@Param('id') id: string, @Body() dto: RoleDto, @CurrentUser() actor: { sub: string; role: string }) {
    const old = await this.db.user.findUniqueOrThrow({ where: { id }, select: { role: true } });
    const user = await this.db.user.update({ where: { id }, data: { role: dto.role } });
    await this.db.auditLog.create({ data: { actorId: actor.sub, actorRole: actor.role, action: 'USER_ROLE_CHANGED', entityType: 'USER', entityId: id, oldValue: old, newValue: { role: dto.role } } });
    return user;
  }
  @Patch('users/:id/status') async userStatus(@Param('id') id: string, @Body() dto: UserStatusDto, @CurrentUser() actor: { sub: string; role: string }) {
    if (id === actor.sub && dto.status !== 'ACTIVE') throw new Error('Administrators cannot suspend themselves');
    const old = await this.db.user.findUniqueOrThrow({ where: { id }, select: { status: true } });
    const user = await this.db.user.update({ where: { id }, data: { status: dto.status } });
    await this.db.auditLog.create({ data: { actorId: actor.sub, actorRole: actor.role, action: 'USER_STATUS_CHANGED', entityType: 'USER', entityId: id, oldValue: old, newValue: { status: dto.status } } });
    return user;
  }
  @Get('vendors/pending') @Roles(Role.ADMIN, Role.MODERATOR) vendors() { return this.db.vendorProfile.findMany({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO'] } }, include: { user: { select: { phone: true, profile: true } } }, orderBy: { userId: 'asc' } }); }
  @Patch('vendors/:id/status') @Roles(Role.ADMIN, Role.MODERATOR) async vendorStatus(@Param('id') id: string, @Body() dto: VendorStatusDto, @CurrentUser() actor: { sub: string; role: string }) {
    const vendor = await this.db.vendorProfile.update({ where: { id }, data: { status: dto.status, approvedAt: dto.status === 'APPROVED' ? new Date() : undefined } });
    if (dto.status === 'APPROVED') await this.db.user.update({ where: { id: vendor.userId }, data: { role: 'VENDOR' } });
    await this.db.notification.create({ data: { userId: vendor.userId, type: 'VENDOR_REVIEW', title: `Vendor application ${dto.status.toLowerCase().replace('_', ' ')}`, body: dto.reason ?? `Your vendor application is now ${dto.status.toLowerCase().replace('_', ' ')}.` } });
    await this.db.auditLog.create({ data: { actorId: actor.sub, actorRole: actor.role, action: 'VENDOR_STATUS_CHANGED', entityType: 'VENDOR', entityId: id, newValue: { status: dto.status, reason: dto.reason } } });
    return vendor;
  }
  @Get('reports') @Roles(Role.ADMIN, Role.MODERATOR) reports() { return this.db.report.findMany({ include: { reporter: { select: { profile: true } }, reported: { select: { profile: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }); }
  @Patch('reports/:id/status') @Roles(Role.ADMIN, Role.MODERATOR) reportStatus(@Param('id') id: string, @Body() dto: ReportStatusDto) { return this.db.report.update({ where: { id }, data: { status: dto.status } }); }
  @Get('withdrawals') @Roles(Role.ADMIN, Role.FINANCE) withdrawals() { return this.db.withdrawal.findMany({ include: { user: { select: { phone: true, profile: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }); }
  @Patch('withdrawals/:id/status') @Roles(Role.ADMIN, Role.FINANCE) async withdrawalStatus(@Param('id') id: string, @Body() dto: WithdrawalStatusDto, @CurrentUser() actor: { sub: string; role: string }) {
    return this.db.$transaction(async tx => {
      const withdrawal = await tx.withdrawal.findUniqueOrThrow({ where: { id } });
      if (!['PENDING', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING'].includes(withdrawal.status)) throw new Error('Withdrawal already finalized');
      if (['REJECTED', 'CANCELLED', 'FAILED', 'REVERSED'].includes(dto.status)) await tx.wallet.update({ where: { userId: withdrawal.userId }, data: { held: { decrement: withdrawal.amount }, availableEarning: { increment: withdrawal.amount } } });
      if (dto.status === 'COMPLETED') await tx.wallet.update({ where: { userId: withdrawal.userId }, data: { held: { decrement: withdrawal.amount } } });
      const result = await tx.withdrawal.update({ where: { id }, data: { status: dto.status, rejectionReason: dto.reason } });
      await tx.notification.create({ data: { userId: withdrawal.userId, type: 'WITHDRAWAL', title: `Withdrawal ${dto.status.toLowerCase()}`, body: dto.reason ?? `Your withdrawal is now ${dto.status.toLowerCase()}.` } });
      await tx.auditLog.create({ data: { actorId: actor.sub, actorRole: actor.role, action: 'WITHDRAWAL_STATUS_CHANGED', entityType: 'WITHDRAWAL', entityId: id, newValue: { status: dto.status, reason: dto.reason } } });
      return result;
    });
  }
  @Get('audit-logs') auditLogs() { return this.db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }); }
}
