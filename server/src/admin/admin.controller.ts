import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  PackageType,
  Prisma,
  ReportStatus,
  Role,
  StaffPermissionKey,
  UserStatus,
  VendorStatus,
  WithdrawalStatus,
} from "@prisma/client";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtGuard } from "../common/guards/jwt.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../wallet/wallet.service";
import { PayoutCryptoService } from "../security/payout-crypto.service";
import { CallsService } from "../calls/calls.service";
class SettingDto {
  @IsObject() value!: Record<string, unknown>;
  @IsOptional() @IsString() description?: string;
}
class RoleDto {
  @IsEnum(Role) role!: Role;
}
class UserStatusDto {
  @IsEnum(UserStatus) status!: UserStatus;
}
class VendorStatusDto {
  @IsEnum(VendorStatus) status!: VendorStatus;
  @IsOptional() @IsString() reason?: string;
}
class ReportStatusDto {
  @IsEnum(ReportStatus) status!: ReportStatus;
  @IsOptional() @IsString() resolution?: string;
  @IsOptional() @IsString() assignedModeratorId?: string;
}
class WithdrawalStatusDto {
  @IsEnum(WithdrawalStatus) status!: WithdrawalStatus;
  @IsOptional() @IsString() reason?: string;
}
class CatalogPackageDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(PackageType) type?: PackageType;
  @IsOptional() @IsInt() @Min(0) price?: number;
  @IsOptional() @IsInt() @Min(0) points?: number;
  @IsOptional() @IsInt() @Min(0) voiceSeconds?: number;
  @IsOptional() @IsInt() @Min(0) videoSeconds?: number;
  @IsOptional() @IsInt() @Min(0) messageCount?: number;
  @IsOptional() @IsInt() @Min(1) validityDays?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
class GiftCardAdminDto extends CatalogPackageDto {
  @IsOptional() @IsBoolean() transferable?: boolean;
  @IsOptional() @IsBoolean() vendorSpecific?: boolean;
}
class DigitalGiftAdminDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() iconUrl?: string;
  @IsOptional() @IsString() animationUrl?:string;
  @IsOptional() @IsString() category?:string;
  @IsOptional() @IsInt() @Min(1) pointPrice?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) vendorPercent?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() enabledInCalls?:boolean;
  @IsOptional() @IsBoolean() enabledInChats?:boolean;
  @IsOptional() @IsInt() displayOrder?:number;
}
class VendorPricingDto {
  @IsOptional() @IsInt() @Min(0) voiceRatePerMinute?: number;
  @IsOptional() @IsInt() @Min(0) videoRatePerMinute?: number;
  @IsOptional() @IsInt() @Min(0) paidChatRate?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) commissionPercent?: number;
  @IsOptional() @IsBoolean() voiceCallEnabled?: boolean;
  @IsOptional() @IsBoolean() videoCallEnabled?: boolean;
}
class MembershipAdminDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(0) price?: number;
  @IsOptional() @IsInt() @Min(1) durationDays?: number;
  @IsOptional() @IsObject() benefits?: Record<string, unknown>;
  @IsOptional() @IsString() badge?: string;
  @IsOptional() @IsInt() displayOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
class NotificationCampaignDto{@IsString()@MaxLength(120)title!:string;@IsString()@MaxLength(500)body!:string;@IsOptional()@IsString()@MaxLength(80)type?:string;@IsOptional()@IsEnum(Role)role?:Role}
class BalanceAdjustmentDto{@IsInt()@Min(-100000000)@Max(100000000)amount!:number;@IsString()@MaxLength(500)reason!:string;@IsString()@MaxLength(100)idempotencyKey!:string}
@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly db: PrismaService,
    private readonly wallets: WalletService,
    private readonly crypto: PayoutCryptoService,
    private readonly callsService: CallsService,
  ) {}
  @Get("dashboard")
  @Roles(Role.ADMIN, Role.MODERATOR, Role.FINANCE)
  @RequirePermissions(StaffPermissionKey.VIEW_DASHBOARD)
  async dashboard() {
    const today=new Date();today.setHours(0,0,0,0);
    const [
      users,
      activeUsers,
      onlineUsers,
      vendors,
      pendingVendors,
      pendingPayments,
      pendingWithdrawals,
      openReports,
      openSupportTickets,
      revenue,
      callsToday,
      callTotals,
      messagesToday,
      giftsToday,
      giftTotals,
      earningTotals,
      successfulPayments,
      failedPayments,
    ] = await Promise.all([
      this.db.user.count(),
      this.db.user.count({where:{status:'ACTIVE'}}),
      this.db.profile.count({where:{online:true,user:{status:'ACTIVE'}}}),
      this.db.vendorProfile.count({ where: { status: "APPROVED" } }),
      this.db.vendorProfile.count({where:{status:{in:['SUBMITTED','UNDER_REVIEW','MORE_INFO']}}}),
      this.db.payment.count({
        where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      }),
      this.db.withdrawal.count({
        where: { status: { in: ["PENDING", "UNDER_REVIEW"] } },
      }),
      this.db.report.count({ where: { status: "OPEN" } }),
      this.db.supportTicket.count({
        where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER"] } },
      }),
      this.db.platformLedger.aggregate({
        where: { type: "COMMISSION" },
        _sum: { amount: true },
      }),
      this.db.callSession.count({where:{createdAt:{gte:today}}}),
      this.db.callSession.aggregate({where:{createdAt:{gte:today}},_sum:{billedSeconds:true,grossAmount:true,vendorAmount:true,platformAmount:true}}),
      this.db.message.count({where:{createdAt:{gte:today}}}),
      this.db.giftTransaction.count({where:{createdAt:{gte:today},status:'COMPLETED'}}),
      this.db.giftTransaction.aggregate({where:{createdAt:{gte:today},status:'COMPLETED'},_sum:{grossAmount:true,vendorAmount:true,platformAmount:true}}),
      this.db.earning.aggregate({where:{createdAt:{gte:today}},_sum:{grossAmount:true,vendorAmount:true,platformAmount:true}}),
      this.db.payment.count({where:{status:'APPROVED',createdAt:{gte:today}}}),
      this.db.payment.count({where:{status:{in:['REJECTED','CANCELLED']},createdAt:{gte:today}}}),
    ]);
    return {
      users,
      activeUsers,
      onlineUsers,
      approvedVendors: vendors,
      pendingVendors,
      pendingPayments,
      pendingWithdrawals,
      openReports,
      openSupportTickets,
      platformRevenue: revenue._sum.amount ?? 0,
      callsToday,
      callMinutesToday:Math.ceil((callTotals._sum.billedSeconds??0)/60),
      messagesToday,
      giftsToday,
      grossRevenueToday:(callTotals._sum.grossAmount??0)+(giftTotals._sum.grossAmount??0),
      vendorEarningsToday:earningTotals._sum.vendorAmount??0,
      platformCommissionToday:(callTotals._sum.platformAmount??0)+(giftTotals._sum.platformAmount??0),
      successfulPaymentsToday:successfulPayments,
      failedPaymentsToday:failedPayments,
    };
  }
  @Get("calls")
  @Roles(Role.ADMIN, Role.MODERATOR, Role.FINANCE)
  @RequirePermissions(StaffPermissionKey.VIEW_DASHBOARD)
  async calls() {
    const calls=await this.db.callSession.findMany({include:{vendor:{select:{legalName:true,userId:true,user:{select:{profile:{select:{displayName:true,username:true}}}}}}},orderBy:{createdAt:'desc'},take:500});
    const callers=await this.db.user.findMany({where:{id:{in:[...new Set(calls.map(call=>call.callerId))]}},select:{id:true,profile:{select:{displayName:true,username:true}}}}),byId=new Map(callers.map(user=>[user.id,user.profile]));
    return calls.map(call=>({...call,caller:byId.get(call.callerId)??null,channelName:`call_${call.id}`}));
  }
  @Post("calls/:id/terminate")
  @RequirePermissions(StaffPermissionKey.MANAGE_USERS)
  async terminateCall(@Param("id") id:string,@CurrentUser() actor:{sub:string;role:string}){const call=await this.callsService.terminateByAdmin(id,actor.sub);await this.db.auditLog.create({data:{actorId:actor.sub,actorRole:actor.role,action:'CALL_TERMINATED_BY_ADMIN',entityType:'CALL',entityId:id,newValue:{status:call.status,reason:call.disconnectReason}}});return call}
  @Get('notification-campaigns')@RequirePermissions(StaffPermissionKey.MANAGE_SETTINGS)campaigns(){return this.db.notificationCampaign.findMany({orderBy:{createdAt:'desc'},take:100})}
  @Post('notification-campaigns')@RequirePermissions(StaffPermissionKey.MANAGE_SETTINGS)async campaign(@Body()dto:NotificationCampaignDto,@CurrentUser()actor:{sub:string;role:string}){const where:Prisma.UserWhereInput={status:'ACTIVE',...(dto.role?{role:dto.role}:{})},users=await this.db.user.findMany({where,select:{id:true},take:100000}),type=dto.type?.trim().toUpperCase()||'PROMOTIONAL_OFFER';return this.db.$transaction(async tx=>{const campaign=await tx.notificationCampaign.create({data:{title:dto.title.trim(),body:dto.body.trim(),type,audience:dto.role?{role:dto.role}:{allActive:true},createdBy:actor.sub,recipientCount:users.length}});if(users.length)await tx.notification.createMany({data:users.map(user=>({userId:user.id,type,title:dto.title.trim(),body:dto.body.trim(),data:{campaignId:campaign.id}}))});await tx.auditLog.create({data:{actorId:actor.sub,actorRole:actor.role,action:'NOTIFICATION_CAMPAIGN_CREATED',entityType:'NOTIFICATION_CAMPAIGN',entityId:campaign.id,newValue:{type,role:dto.role??'ALL',recipientCount:users.length}}});return campaign})}
  @Get("settings")
  @RequirePermissions(StaffPermissionKey.MANAGE_SETTINGS)
  settings() {
    return this.db.setting.findMany({ orderBy: { key: "asc" } });
  }
  @Get("users") @RequirePermissions(StaffPermissionKey.MANAGE_USERS) users() {
    return this.db.user.findMany({
      select: {
        id: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        profile: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
  @Post("users/:id/adjust-balance") @RequirePermissions(StaffPermissionKey.MANAGE_FINANCE)
  async adjustBalance(@Param("id")id:string,@Body()dto:BalanceAdjustmentDto,@CurrentUser()actor:{sub:string;role:string}){if(dto.amount===0)throw new BadRequestException('Adjustment amount cannot be zero');if(dto.reason.trim().length<5)throw new BadRequestException('A clear adjustment reason is required');const key=`admin-adjustment:${actor.sub}:${dto.idempotencyKey}`;return this.wallets.transaction(async tx=>{const prior=await tx.walletLedger.findUnique({where:{idempotencyKey:key}});if(prior)return{ledger:prior,duplicate:true};const input={userId:id,type:'ADMIN_ADJUSTMENT' as const,direction:(dto.amount>0?'CREDIT':'DEBIT') as 'CREDIT'|'DEBIT',amount:Math.abs(dto.amount),referenceType:'ADMIN_ADJUSTMENT',referenceId:dto.idempotencyKey,description:dto.reason.trim(),idempotencyKey:key,metadata:{actorId:actor.sub}};if(dto.amount>0)await this.wallets.creditPurchased(tx,input);else await this.wallets.debitPurchased(tx,input);const ledger=await tx.walletLedger.findUniqueOrThrow({where:{idempotencyKey:key}});await tx.auditLog.create({data:{actorId:actor.sub,actorRole:actor.role,action:'USER_BALANCE_ADJUSTED',entityType:'USER',entityId:id,newValue:{amount:dto.amount,reason:dto.reason.trim(),ledgerId:ledger.id}}});return{ledger,duplicate:false}})}
  @Patch("settings/:key")
  @RequirePermissions(StaffPermissionKey.MANAGE_SETTINGS)
  async setting(
    @Param("key") key: string,
    @Body() dto: SettingDto,
    @CurrentUser() actor: { sub: string; role: string },
  ) {
    this.validateSetting(key,dto.value);
    const old = await this.db.setting.findUnique({ where: { key } });
    const value = dto.value as Prisma.InputJsonObject;
    const result = await this.db.setting.upsert({
      where: { key },
      create: {
        key,
        value,
        description: dto.description,
        updatedBy: actor.sub,
      },
      update: { value, description: dto.description, updatedBy: actor.sub },
    });
    await this.db.auditLog.create({
      data: {
        actorId: actor.sub,
        actorRole: actor.role,
        action: "SETTING_UPDATED",
        entityType: "SETTING",
        entityId: key,
        oldValue: old?.value ?? undefined,
        newValue: value,
      },
    });
    return result;
  }
  private validateSetting(key:string,value:Record<string,unknown>){
    const integer=(field:string,min:number,max:number)=>{const candidate=value[field];if(!Number.isInteger(candidate)||Number(candidate)<min||Number(candidate)>max)throw new BadRequestException(`${key}.${field} must be an integer from ${min} to ${max}`)};
    if(key==='DEFAULT_VENDOR_COMMISSION')integer('percent',0,100);
    if(key==='EARNING_HOLD_DAYS')integer('days',0,90);
    if(key==='CALL_GRACE_SECONDS')integer('seconds',0,300);
    if(key==='POINT_CONVERSION'){integer('currencyMinorUnitsPerPoint',1,1_000_000);if(typeof value.currency!=='string'||!/^[A-Z]{3}$/.test(value.currency))throw new BadRequestException('POINT_CONVERSION.currency must be an ISO-style three-letter code')}
    if(key==='WITHDRAWAL_RULES'){integer('minimum',1,10_000_000);integer('maximumDaily',1,100_000_000);integer('feePoints',0,1_000_000);integer('requiredAccountAgeDays',0,3650);integer('requiredCompletedCalls',0,100_000);if(typeof value.requiredIdentityVerification!=='boolean')throw new BadRequestException('WITHDRAWAL_RULES.requiredIdentityVerification must be boolean');if(Number(value.maximumDaily)<Number(value.minimum))throw new BadRequestException('Withdrawal daily maximum cannot be below its minimum')}
    if(key==='BILLING_ROUNDING'&&!['EXACT_SECOND','UP_30_SECONDS','UP_FULL_MINUTE','MINIMUM_ONE_MINUTE'].includes(String(value.method)))throw new BadRequestException('Unsupported billing rounding method');
  }
  @Patch("users/:id/role")
  @RequirePermissions(StaffPermissionKey.MANAGE_STAFF)
  async role(
    @Param("id") id: string,
    @Body() dto: RoleDto,
    @CurrentUser() actor: { sub: string; role: string },
  ) {
    if (id === actor.sub && dto.role !== Role.ADMIN) throw new BadRequestException("You cannot demote your own administrator account");
    const old = await this.db.user.findUniqueOrThrow({
      where: { id },
      select: { role: true },
    });
    const user = await this.db.user.update({
      where: { id },
      data: { role: dto.role },
    });
    await this.db.auditLog.create({
      data: {
        actorId: actor.sub,
        actorRole: actor.role,
        action: "USER_ROLE_CHANGED",
        entityType: "USER",
        entityId: id,
        oldValue: old,
        newValue: { role: dto.role },
      },
    });
    return user;
  }
  @Patch("users/:id/status")
  @RequirePermissions(StaffPermissionKey.MANAGE_USERS)
  async userStatus(
    @Param("id") id: string,
    @Body() dto: UserStatusDto,
    @CurrentUser() actor: { sub: string; role: string },
  ) {
    if (id === actor.sub && dto.status !== "ACTIVE")
      throw new Error("Administrators cannot suspend themselves");
    const old = await this.db.user.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    const user = await this.db.user.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.db.auditLog.create({
      data: {
        actorId: actor.sub,
        actorRole: actor.role,
        action: "USER_STATUS_CHANGED",
        entityType: "USER",
        entityId: id,
        oldValue: old,
        newValue: { status: dto.status },
      },
    });
    return user;
  }
  @Get("vendors/pending") @Roles(Role.ADMIN, Role.MODERATOR) @RequirePermissions(StaffPermissionKey.REVIEW_VENDORS) async vendors() {
    const records = await this.db.vendorProfile.findMany({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "MORE_INFO"] } },
      include: { user: { select: { phone: true, profile: true } } },
      orderBy: { userId: "asc" },
    });
    return records.map(({payoutAccountEncrypted:_payout,...record}) => ({
      ...record,
      nidNumber: record.nidNumber ? "••••••••" : null,
      payoutAccount:this.crypto.mask(record.payoutAccountLast4),
    }));
  }
  @Get("vendors/:id/identity")
  @Roles(Role.ADMIN, Role.MODERATOR)
  @RequirePermissions(StaffPermissionKey.REVIEW_VENDORS)
  async vendorIdentity(
    @Param("id") id: string,
    @CurrentUser() actor: { sub: string; role: string },
  ) {
    const vendor = await this.db.vendorProfile.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        legalName: true,
        nidNumber: true,
        nidFrontUrl: true,
        nidBackUrl: true,
        selfieUrl: true,
      },
    });
    const nidNumber = vendor.nidNumber
      ? this.crypto.decrypt(vendor.nidNumber)
      : null;
    await this.db.auditLog.create({
      data: {
        actorId: actor.sub,
        actorRole: actor.role,
        action: "VENDOR_IDENTITY_VIEWED",
        entityType: "VENDOR",
        entityId: id,
      },
    });
    return { ...vendor, nidNumber };
  }
  @Patch("vendors/:id/status")
  @Roles(Role.ADMIN, Role.MODERATOR)
  @RequirePermissions(StaffPermissionKey.REVIEW_VENDORS)
  async vendorStatus(
    @Param("id") id: string,
    @Body() dto: VendorStatusDto,
    @CurrentUser() actor: { sub: string; role: string },
  ) {
    const vendor = await this.db.vendorProfile.update({
      where: { id },
      data: {
        status: dto.status,
        approvedAt: dto.status === "APPROVED" ? new Date() : undefined,
      },
    });
    if (dto.status === "APPROVED")
      await this.db.user.update({
        where: { id: vendor.userId },
        data: { role: "VENDOR" },
      });
    await this.db.notification.create({
      data: {
        userId: vendor.userId,
        type: "VENDOR_REVIEW",
        title: `Vendor application ${dto.status.toLowerCase().replace("_", " ")}`,
        body:
          dto.reason ??
          `Your vendor application is now ${dto.status.toLowerCase().replace("_", " ")}.`,
      },
    });
    await this.db.auditLog.create({
      data: {
        actorId: actor.sub,
        actorRole: actor.role,
        action: "VENDOR_STATUS_CHANGED",
        entityType: "VENDOR",
        entityId: id,
        newValue: { status: dto.status, reason: dto.reason },
      },
    });
    return vendor;
  }
  @Get("reports") @Roles(Role.ADMIN, Role.MODERATOR) @RequirePermissions(StaffPermissionKey.MODERATE_CONTENT) reports() {
    return this.db.report.findMany({
      include: {
        reporter: { select: { profile: true } },
        reported: { select: { profile: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
  @Patch("reports/:id/status")
  @Roles(Role.ADMIN, Role.MODERATOR)
  @RequirePermissions(StaffPermissionKey.MODERATE_CONTENT)
  async reportStatus(
    @Param("id") id: string,
    @Body() dto: ReportStatusDto,
    @CurrentUser() actor: { sub: string; role: string },
  ) {
    const result = await this.db.report.update({
      where: { id },
      data: {
        status: dto.status,
        resolution: dto.resolution,
        assignedModeratorId: dto.assignedModeratorId,
        resolvedAt: ["RESOLVED", "REJECTED"].includes(dto.status)
          ? new Date()
          : null,
      },
    });
    await this.db.auditLog.create({
      data: {
        actorId: actor.sub,
        actorRole: actor.role,
        action: "REPORT_STATUS_CHANGED",
        entityType: "REPORT",
        entityId: id,
        newValue: {
          status: dto.status,
          resolution: dto.resolution,
          assignedModeratorId: dto.assignedModeratorId,
        },
      },
    });
    return result;
  }
  @Get("withdrawals") @Roles(Role.ADMIN, Role.FINANCE) @RequirePermissions(StaffPermissionKey.MANAGE_FINANCE) async withdrawals() {
    const records = await this.db.withdrawal.findMany({
      include: { user: { select: { phone: true, profile: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return records.map(({ accountDetailsEncrypted: _secret, ...record }) => ({
      ...record,
      accountNumber: this.crypto.mask(record.accountLast4),
    }));
  }
  @Get("withdrawals/:id/payout-details")
  @Roles(Role.ADMIN, Role.FINANCE)
  @RequirePermissions(StaffPermissionKey.MANAGE_FINANCE)
  async payoutDetails(
    @Param("id") id: string,
    @CurrentUser() actor: { sub: string; role: string },
  ) {
    const withdrawal = await this.db.withdrawal.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        method: true,
        accountDetailsEncrypted: true,
        accountLast4: true,
        amount:true,
        fee:true,
      },
    });
    const accountNumber = this.crypto.decrypt(
      withdrawal.accountDetailsEncrypted,
    );
    await this.db.auditLog.create({
      data: {
        actorId: actor.sub,
        actorRole: actor.role,
        action: "WITHDRAWAL_PAYOUT_DETAILS_VIEWED",
        entityType: "WITHDRAWAL",
        entityId: id,
        newValue: { method: withdrawal.method, last4: withdrawal.accountLast4 },
      },
    });
    return { id, method: withdrawal.method, accountNumber,amount:withdrawal.amount,fee:withdrawal.fee,netAmount:withdrawal.amount-withdrawal.fee };
  }
  @Patch("withdrawals/:id/status")
  @Roles(Role.ADMIN, Role.FINANCE)
  @RequirePermissions(StaffPermissionKey.MANAGE_FINANCE)
  async withdrawalStatus(
    @Param("id") id: string,
    @Body() dto: WithdrawalStatusDto,
    @CurrentUser() actor: { sub: string; role: string },
  ) {
    return this.db.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUniqueOrThrow({
        where: { id },
      });
      if (
        !["PENDING", "UNDER_REVIEW", "APPROVED", "PROCESSING"].includes(
          withdrawal.status,
        )
      )
        throw new Error("Withdrawal already finalized");
      if (["REJECTED", "CANCELLED", "FAILED", "REVERSED"].includes(dto.status))
        await this.wallets.releaseWithdrawal(
          tx,
          withdrawal.userId,
          withdrawal.amount,
          withdrawal.id,
        );
      if(dto.status==='COMPLETED'&&withdrawal.fee>0)await this.wallets.platformCommission(tx,withdrawal.fee,'WITHDRAWAL',withdrawal.id,'Withdrawal processing fee');
      if (dto.status === "COMPLETED")
        await this.wallets.completeWithdrawal(
          tx,
          withdrawal.userId,
          withdrawal.amount,
          withdrawal.id,
          withdrawal.fee,
        );
      const result = await tx.withdrawal.update({
        where: { id },
        data: { status: dto.status, rejectionReason: dto.reason },
      });
      await tx.notification.create({
        data: {
          userId: withdrawal.userId,
          type: "WITHDRAWAL",
          title: `Withdrawal ${dto.status.toLowerCase()}`,
          body:
            dto.reason ?? `Your withdrawal is now ${dto.status.toLowerCase()}.`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          actorRole: actor.role,
          action: "WITHDRAWAL_STATUS_CHANGED",
          entityType: "WITHDRAWAL",
          entityId: id,
          newValue: { status: dto.status, reason: dto.reason },
        },
      });
      return result;
    });
  }
  @Get("audit-logs") @RequirePermissions(StaffPermissionKey.VIEW_AUDIT_LOGS) auditLogs() {
    return this.db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
  @Get("packages") @RequirePermissions(StaffPermissionKey.MANAGE_CATALOG) packages() {
    return this.db.package.findMany({ orderBy: { createdAt: "desc" } });
  }
  @Post("packages") @RequirePermissions(StaffPermissionKey.MANAGE_CATALOG) packageCreate(@Body() d: CatalogPackageDto) {
    return this.db.package.create({
      data: d as Prisma.PackageUncheckedCreateInput,
    });
  }
  @Patch("packages/:id") @RequirePermissions(StaffPermissionKey.MANAGE_CATALOG) packageUpdate(
    @Param("id") id: string,
    @Body() d: CatalogPackageDto,
  ) {
    return this.db.package.update({ where: { id }, data: d });
  }
  @Patch("gift-cards/:id") @RequirePermissions(StaffPermissionKey.MANAGE_CATALOG) giftCardUpdate(
    @Param("id") id: string,
    @Body() d: GiftCardAdminDto,
  ) {
    return this.db.giftCard.update({ where: { id }, data: d });
  }
  @Get("gift-cards") @RequirePermissions(StaffPermissionKey.MANAGE_CATALOG) giftCards() {
    return this.db.giftCard.findMany({ orderBy: { createdAt: "desc" } });
  }
  @Post("gift-cards") @RequirePermissions(StaffPermissionKey.MANAGE_CATALOG) giftCardCreate(@Body() d: GiftCardAdminDto) {
    return this.db.giftCard.create({
      data: d as Prisma.GiftCardUncheckedCreateInput,
    });
  }
  @Get("digital-gifts") @RequirePermissions(StaffPermissionKey.MANAGE_CATALOG) digitalGifts() {
    return this.db.digitalGift.findMany();
  }
  @Post("digital-gifts") @RequirePermissions(StaffPermissionKey.MANAGE_CATALOG) digitalGiftCreate(@Body() d: DigitalGiftAdminDto) {
    return this.db.digitalGift.create({
      data: d as Prisma.DigitalGiftUncheckedCreateInput,
    });
  }
  @Patch("digital-gifts/:id") @RequirePermissions(StaffPermissionKey.MANAGE_CATALOG) digitalGiftUpdate(
    @Param("id") id: string,
    @Body() d: DigitalGiftAdminDto,
  ) {
    return this.db.digitalGift.update({ where: { id }, data: d });
  }
  @Patch("vendors/:id/pricing") @RequirePermissions(StaffPermissionKey.MANAGE_CATALOG) vendorPricing(
    @Param("id") id: string,
    @Body() d: VendorPricingDto,
  ) {
    return this.db.vendorProfile.update({ where: { id }, data: d });
  }
  @Get("memberships") @RequirePermissions(StaffPermissionKey.MANAGE_CATALOG) memberships() {
    return this.db.membershipPlan.findMany({
      orderBy: { displayOrder: "asc" },
    });
  }
  @Post("memberships") @RequirePermissions(StaffPermissionKey.MANAGE_CATALOG) membershipCreate(@Body() d: MembershipAdminDto) {
    return this.db.membershipPlan.create({
      data: d as Prisma.MembershipPlanUncheckedCreateInput,
    });
  }
  @Patch("memberships/:id") @RequirePermissions(StaffPermissionKey.MANAGE_CATALOG) membershipUpdate(
    @Param("id") id: string,
    @Body() d: MembershipAdminDto,
  ) {
    return this.db.membershipPlan.update({
      where: { id },
      data: d as Prisma.MembershipPlanUpdateInput,
    });
  }
  @Get("referrals") @RequirePermissions(StaffPermissionKey.MANAGE_CATALOG) referrals() {
    return this.db.referral.findMany({
      include: {
        referrer: { select: { profile: true } },
        referred: { select: { profile: true } },
        rewards: true,
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
  }
}
