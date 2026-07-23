import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RestrictionType } from "@prisma/client";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtGuard } from "../common/guards/jwt.guard";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../wallet/wallet.service";
import { RestrictionsService } from "../restrictions/restrictions.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";

class SendGiftDto {
  @IsUUID() receiverId!: string;
  @IsString() @MaxLength(100) idempotencyKey!: string;
  @IsOptional() @IsUUID() callId?: string;
  @IsOptional() @IsUUID() conversationId?: string;
  @IsOptional() @IsUUID() liveId?: string;
}

@ApiTags("Digital gifts")
@Controller("gifts")
export class GiftsController {
  constructor(
    private readonly db: PrismaService,
    private readonly wallets: WalletService,
    private readonly restrictions: RestrictionsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Get()
  list() {
    return this.db.digitalGift.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { pointPrice: "asc" }],
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Post(":id/send")
  async send(
    @Param("id") id: string,
    @Body() d: SendGiftDto,
    @CurrentUser() u: { sub: string },
  ) {
    await this.restrictions.assertAllowed(u.sub, RestrictionType.GIFT);
    const result = await this.wallets.transaction(async (tx) => {
      const key = `gift:${u.sub}:${d.idempotencyKey}`;
      const prior = await tx.walletLedger.findUnique({
        where: { idempotencyKey: `${key}:purchase` },
      });
      if (prior) {
        const transaction = await tx.giftTransaction.findUnique({
          where: { idempotencyKey: key },
        });
        return {
          sent: true,
          duplicate: true,
          receiverId: d.receiverId,
          transaction,
          gift: null as string | null,
          giftIcon: null as string | null,
          senderName: null as string | null,
          pointPrice: null as number | null,
        };
      }
      if (u.sub === d.receiverId) {
        throw new ConflictException("Cannot send a gift to yourself");
      }
      const blocked = await tx.block.findFirst({
        where: {
          OR: [
            { blockerId: u.sub, blockedUserId: d.receiverId },
            { blockerId: d.receiverId, blockedUserId: u.sub },
          ],
        },
      });
      if (blocked) throw new ForbiddenException("Gifting is blocked");

      const gift = await tx.digitalGift.findUnique({ where: { id } });
      const vendor = await tx.vendorProfile.findUnique({
        where: { userId: d.receiverId },
      });
      if (!gift || !gift.active) throw new NotFoundException("Gift not found");

      if (d.callId) {
        if (!gift.enabledInCalls) {
          throw new ConflictException("Gift is not enabled during calls");
        }
        const call = await tx.callSession.findUnique({
          where: { id: d.callId },
          include: { vendor: true },
        });
        if (
          !call ||
          call.status !== "ACTIVE" ||
          call.vendor.userId !== d.receiverId ||
          ![call.callerId, call.vendor.userId].includes(u.sub)
        ) {
          throw new ForbiddenException("Active call is unavailable");
        }
      }

      if (d.conversationId) {
        if (!gift.enabledInChats) {
          throw new ConflictException("Gift is not enabled in chat");
        }
        const conversation = await tx.conversation.findUnique({
          where: { id: d.conversationId },
        });
        if (
          !conversation ||
          ![conversation.userOneId, conversation.userTwoId].includes(u.sub) ||
          ![conversation.userOneId, conversation.userTwoId].includes(
            d.receiverId,
          )
        ) {
          throw new ForbiddenException("Conversation is unavailable");
        }
      }

      if (d.liveId) {
        if (!gift.enabledInLive) {
          throw new ConflictException("Gift is not enabled during live streams");
        }
        const session = await tx.liveSession.findUnique({
          where: { id: d.liveId },
        });
        if (!session || session.status !== "LIVE") {
          throw new ForbiddenException("Live stream is unavailable");
        }
        if (session.hostId !== d.receiverId) {
          throw new ForbiddenException(
            "Live gifts can only be sent to the host",
          );
        }
      }

      if (!vendor || vendor.status !== "APPROVED") {
        throw new NotFoundException("Recipient vendor not found");
      }

      const sender = await tx.profile.findUnique({
        where: { userId: u.sub },
        select: { displayName: true },
      });

      await this.wallets.debitPurchased(tx, {
        userId: u.sub,
        type: "GIFT_PURCHASE",
        direction: "DEBIT",
        amount: gift.pointPrice,
        referenceType: "DIGITAL_GIFT",
        referenceId: gift.id,
        description: `Sent ${gift.name}`,
        idempotencyKey: `${key}:purchase`,
      });

      const vendorAmount = Math.floor(
        (gift.pointPrice * gift.vendorPercent) / 100,
      );
      const platformAmount = gift.pointPrice - vendorAmount;
      const holdSetting = await tx.setting.findUnique({
        where: { key: "EARNING_HOLD_DAYS" },
        select: { value: true },
      });
      const holdValue = holdSetting?.value as Record<string, unknown> | undefined;
      const configuredDays = holdValue?.days;
      const holdDays =
        typeof configuredDays === "number" &&
        Number.isSafeInteger(configuredDays)
          ? Math.min(90, Math.max(0, configuredDays))
          : 7;

      await this.wallets.creditPendingEarning(
        tx,
        d.receiverId,
        vendorAmount,
        key,
        "GIFT",
      );
      await this.wallets.platformCommission(
        tx,
        platformAmount,
        "DIGITAL_GIFT",
        key,
        "Digital gift commission",
      );
      await tx.earning.create({
        data: {
          vendorId: vendor.id,
          sourceType: "GIFT",
          sourceId: key,
          grossAmount: gift.pointPrice,
          vendorAmount,
          platformAmount,
          availableAt: new Date(Date.now() + holdDays * 86400000),
        },
      });

      const transaction = await tx.giftTransaction.create({
        data: {
          giftId: gift.id,
          senderId: u.sub,
          receiverId: d.receiverId,
          callId: d.callId,
          conversationId: d.conversationId,
          liveId: d.liveId,
          grossAmount: gift.pointPrice,
          vendorAmount,
          platformAmount,
          idempotencyKey: key,
        },
      });

      await tx.notification.create({
        data: {
          userId: d.receiverId,
          type: "GIFT",
          title: `You received ${gift.name}`,
          body: `${sender?.displayName ?? "A supporter"} sent you ${gift.name}.`,
          data: {
            giftId: gift.id,
            liveId: d.liveId ?? null,
            callId: d.callId ?? null,
            senderId: u.sub,
          },
        },
      });

      return {
        sent: true,
        duplicate: false,
        gift: gift.name,
        giftIcon: gift.iconUrl,
        senderName: sender?.displayName ?? "Someone",
        pointPrice: gift.pointPrice,
        receiverId: d.receiverId,
        vendorAmount,
        transaction,
      };
    });

    if (!result.duplicate) {
      const animationPayload = {
        gift: result.gift,
        giftIcon: result.giftIcon,
        senderName: result.senderName,
        pointPrice: result.pointPrice,
        senderId: u.sub,
        receiverId: d.receiverId,
        liveId: d.liveId ?? null,
        callId: d.callId ?? null,
        transaction: result.transaction,
      };
      this.realtime.users([u.sub, d.receiverId], "gift:received", {
        gift: result.gift,
        transaction: result.transaction,
      });
      if (d.liveId) {
        this.realtime.room(`live:${d.liveId}`, "gift:animation", animationPayload);
      } else if (d.callId) {
        this.realtime.users(
          [u.sub, d.receiverId],
          "gift:animation",
          animationPayload,
        );
      } else {
        this.realtime.users(
          [u.sub, d.receiverId],
          "gift:animation",
          animationPayload,
        );
      }
    }
    return result;
  }
}
