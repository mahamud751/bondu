import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Role, StaffPermissionKey } from "@prisma/client";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";
import type { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtGuard } from "../common/guards/jwt.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { PrismaService } from "../prisma/prisma.service";
class RangeDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export const csvCell = (value: unknown) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
@ApiTags("Admin exports")
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard, PermissionsGuard)
@RequirePermissions(StaffPermissionKey.EXPORT_DATA)
@Controller("admin/exports")
export class ExportsController {
  constructor(private readonly db: PrismaService) {}
  @Roles(Role.ADMIN) @Get("users/:id") async user(
    @Param("id") id: string,
    @CurrentUser() actor: { sub: string; role: string },
  ) {
    const data = await this.db.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        phone: true,
        email: true,
        role: true,
        status: true,
        phoneVerifiedAt: true,
        emailVerifiedAt: true,
        dateOfBirth: true,
        termsAcceptedAt: true,
        lastLoginAt: true,
        createdAt: true,
        deletedAt: true,
        profile: true,
        vendor: {
          select: {
            id: true,
            status: true,
            commissionPercent: true,
            voiceRatePerMinute: true,
            videoRatePerMinute: true,
            paidChatRate: true,
            averageRating: true,
            approvedAt: true,
          },
        },
        wallet: true,
        payments: { orderBy: { createdAt: "desc" }, take: 1000 },
        withdrawals: {
          select: {
            id: true,
            amount: true,
            fee: true,
            method: true,
            status: true,
            rejectionReason: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1000,
        },
        reviewsMade: { orderBy: { createdAt: "desc" }, take: 1000 },
        reportsMade: { orderBy: { createdAt: "desc" }, take: 1000 },
        sessions: {
          select: {
            deviceId: true,
            deviceName: true,
            platform: true,
            lastUsedAt: true,
            revokedAt: true,
            createdAt: true,
          },
        },
        authIdentities: {
          select: {
            provider: true,
            email: true,
            createdAt: true,
            lastUsedAt: true,
          },
        },
      },
    });
    const ledger = await this.db.walletLedger.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    const calls = await this.db.callSession.findMany({
      where: { OR: [{ callerId: id }, { vendor: { userId: id } }] },
      select: {
        id: true,
        callerId: true,
        vendorId: true,
        callType: true,
        status: true,
        connectedAt: true,
        endedAt: true,
        durationSeconds: true,
        billedSeconds: true,
        grossAmount: true,
        vendorAmount: true,
        platformAmount: true,
        disconnectReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    await this.db.auditLog.create({
      data: {
        actorId: actor.sub,
        actorRole: actor.role,
        action: "USER_DATA_EXPORTED",
        entityType: "USER",
        entityId: id,
      },
    });
    return { generatedAt: new Date(), user: data, walletLedger: ledger, calls };
  }
  @Roles(Role.ADMIN, Role.FINANCE) @Get("finance.csv") async finance(
    @Query() range: RangeDto,
    @CurrentUser() actor: { sub: string; role: string },
    @Res() response: Response,
  ) {
    const { from, to } = this.range(range),
      [payments, commissions, withdrawals] = await Promise.all([
        this.db.payment.findMany({
          where: { createdAt: { gte: from, lte: to } },
          select: {
            id: true,
            gateway: true,
            status: true,
            amount: true,
            transactionId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        }),
        this.db.platformLedger.findMany({
          where: { createdAt: { gte: from, lte: to } },
          orderBy: { createdAt: "asc" },
        }),
        this.db.withdrawal.findMany({
          where: { createdAt: { gte: from, lte: to } },
          select: {
            id: true,
            method: true,
            status: true,
            amount: true,
            fee: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        }),
      ]),
      rows = [
        [
          "record_type",
          "id",
          "provider_or_type",
          "status",
          "gross_amount",
          "fee_or_zero",
          "reference",
          "created_at",
        ],
        ...payments.map((x) => [
          "PAYMENT",
          x.id,
          x.gateway,
          x.status,
          x.amount,
          0,
          x.transactionId,
          x.createdAt.toISOString(),
        ]),
        ...commissions.map((x) => [
          "COMMISSION",
          x.id,
          x.type,
          "RECORDED",
          x.amount,
          0,
          `${x.referenceType}:${x.referenceId}`,
          x.createdAt.toISOString(),
        ]),
        ...withdrawals.map((x) => [
          "WITHDRAWAL",
          x.id,
          x.method,
          x.status,
          x.amount,
          x.fee,
          "",
          x.createdAt.toISOString(),
        ]),
      ],
      csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    await this.db.auditLog.create({
      data: {
        actorId: actor.sub,
        actorRole: actor.role,
        action: "FINANCE_CSV_EXPORTED",
        entityType: "FINANCE",
        newValue: {
          from: from.toISOString(),
          to: to.toISOString(),
          rows: rows.length - 1,
        },
      },
    });
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="socialconnect-finance-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv"`,
    );
    response.send(`\uFEFF${csv}`);
  }
  @Roles(Role.ADMIN, Role.FINANCE)
  @Get("analytics")
  async analytics(@Query() range: RangeDto) {
    const { from, to } = this.range(range);
    const payments = await this.db.$queryRaw<
      Array<{ day: Date; successful: string; failed: string; revenue: string }>
    >`
      SELECT date_trunc('day', "createdAt") AS day,
        count(*) FILTER (WHERE status IN ('APPROVED','PARTIALLY_REFUNDED','REFUNDED'))::text AS successful,
        count(*) FILTER (WHERE status IN ('REJECTED','CANCELLED'))::text AS failed,
        COALESCE(sum(amount) FILTER (WHERE status IN ('APPROVED','PARTIALLY_REFUNDED')),0)::text AS revenue
      FROM "Payment" WHERE "createdAt" BETWEEN ${from} AND ${to} GROUP BY 1 ORDER BY 1`;
    const calls = await this.db.$queryRaw<
      Array<{ day: Date; calls: string; seconds: string; commission: string }>
    >`
      SELECT date_trunc('day', "createdAt") AS day,
        count(*) FILTER (WHERE status='COMPLETED')::text AS calls,
        COALESCE(sum("billedSeconds") FILTER (WHERE status='COMPLETED'),0)::text AS seconds,
        COALESCE(sum("platformAmount") FILTER (WHERE status='COMPLETED'),0)::text AS commission
      FROM "CallSession" WHERE "createdAt" BETWEEN ${from} AND ${to} GROUP BY 1 ORDER BY 1`;
    return {
      from,
      to,
      payments: payments.map((item) => ({
        ...item,
        successful: Number(item.successful),
        failed: Number(item.failed),
        revenue: Number(item.revenue),
      })),
      calls: calls.map((item) => ({
        ...item,
        calls: Number(item.calls),
        minutes: Math.round(Number(item.seconds) / 60),
        commission: Number(item.commission),
        seconds: undefined,
      })),
    };
  }

  private range(input: RangeDto) {
    const to = input.to ? new Date(input.to) : new Date();
    const from = input.from
      ? new Date(input.from)
      : new Date(to.getTime() - 30 * 86_400_000);
    if (to < from || to.getTime() - from.getTime() > 366 * 86_400_000) {
      throw new BadRequestException(
        "Export range must be between 0 and 366 days",
      );
    }
    return { from, to };
  }
}
