import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CallStatus, CallType, Prisma, RestrictionType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { RtcTokenService } from "../rtc/rtc-token.service";
import { WalletService } from "../wallet/wallet.service";
import { isWithinVendorSchedule } from "../vendors/vendor-schedule";
import { RestrictionsService } from "../restrictions/restrictions.service";
import { RequestCallDto } from "./calls.dto";
import { billableSeconds, BillingRoundingMethod, settingNumber } from './call-billing-policy';

@Injectable()
export class CallsService {
  constructor(
    private readonly db: PrismaService,
    private readonly wallets: WalletService,
    private readonly realtime: RealtimeGateway,
    private readonly rtc: RtcTokenService,
    private readonly restrictions: RestrictionsService,
  ) {}

  async request(callerId: string, dto: RequestCallDto) {
    await this.restrictions.assertAllowed(callerId, RestrictionType.CALL);
    const scopedKey = `${callerId}:${dto.idempotencyKey}`;
    const result = await this.wallets.transaction(async (tx) => {
      const prior = await tx.callSession.findUnique({
        where: { idempotencyKey: scopedKey },
      });
      if (prior) return prior;
      const vendor = await tx.vendorProfile.findUnique({
        where: { id: dto.vendorId },
        include: { user: { include: { profile: true } }, schedules: true },
      });
      if (!vendor || vendor.status !== "APPROVED")
        throw new NotFoundException("Vendor not found");
      if (!vendor.availableForCall)
        throw new ConflictException("Vendor is unavailable");
      if (vendor.breakActive)
        throw new ConflictException("Vendor is taking a break");
      if (!isWithinVendorSchedule(vendor.schedules))
        throw new ConflictException("Vendor is outside their working hours");
      if (dto.callType === "VOICE" && !vendor.voiceCallEnabled)
        throw new ConflictException("Voice calls are disabled");
      if (dto.callType === "VIDEO" && !vendor.videoCallEnabled)
        throw new ConflictException("Video calls are disabled");
      if (vendor.userId === callerId)
        throw new ForbiddenException("Self calling is prohibited");
      const blocked = await tx.block.findFirst({
        where: {
          OR: [
            { blockerId: callerId, blockedUserId: vendor.userId },
            { blockerId: vendor.userId, blockedUserId: callerId },
          ],
        },
      });
      if (blocked) throw new ForbiddenException("Calling is blocked");
      if (vendor.user.profile?.callsFromEveryone === false) {
        const follows = await tx.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: callerId,
              followingId: vendor.userId,
            },
          },
          select: { id: true },
        });
        if (!follows)
          throw new ForbiddenException(
            "This creator accepts calls from followers only",
          );
      }
      if (vendor.maximumDailyCalls) {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const callsToday = await tx.callSession.count({ where: { vendorId: vendor.id, createdAt: { gte: start }, status: { notIn: ['REJECTED', 'CANCELLED', 'FAILED', 'MISSED'] } } });
        if (callsToday >= vendor.maximumDailyCalls)
          throw new ConflictException("Vendor has reached their daily call limit");
      }
      if (vendor.minimumCallerBalance > 0) {
        const wallet = await tx.wallet.findUnique({ where: { userId: callerId }, select: { purchased:true,promotional:true,reserved:true } });
        const spendable = (wallet?.purchased ?? 0) + (wallet?.promotional ?? 0) - (wallet?.reserved ?? 0);
        if (spendable < vendor.minimumCallerBalance)
          throw new ForbiddenException(`A minimum spendable balance of ${vendor.minimumCallerBalance} points is required`);
      }
      const allowance =
        dto.callType === "VIDEO"
          ? { remainingVideoSeconds: { gte: dto.maximumSeconds } }
          : { remainingVoiceSeconds: { gte: dto.maximumSeconds } };
      const gift = await tx.userGiftCard.findFirst({
        where: {
          recipientId: callerId,
          activatedAt: { not: null },
          status: { in: ["ACTIVE", "PARTIALLY_USED"] },
          expiresAt: { gt: new Date() },
          ...allowance,
          OR: [{ vendorId: null }, { vendorId: vendor.id }],
        },
        orderBy: { expiresAt: "asc" },
      });
      const prepaid = gift
        ? null
        : await tx.userPackage.findFirst({
            where: {
              userId: callerId,
              active: true,
              expiresAt: { gt: new Date() },
              ...allowance,
            },
            orderBy: { expiresAt: "asc" },
          });
      const membership = await tx.userSubscription.findFirst({
          where: {
            userId: callerId,
            status: "ACTIVE",
            expiresAt: { gt: new Date() },
          },
          include: { plan: true },
          orderBy: { expiresAt: "desc" },
        }),
        benefits = (membership?.plan.benefits ?? {}) as {
          callDiscountPercent?: number;
          voiceDiscountPercent?: number;
          videoDiscountPercent?: number;
        },
        discount =
          dto.callType === "VIDEO"
            ? (benefits.videoDiscountPercent ??
              benefits.callDiscountPercent ??
              0)
            : (benefits.voiceDiscountPercent ??
              benefits.callDiscountPercent ??
              0),
        baseRate =
          dto.callType === "VIDEO"
            ? vendor.videoRatePerMinute
            : vendor.voiceRatePerMinute;
      const sourceType = gift ? "GIFT_CARD" : prepaid ? "PACKAGE" : "WALLET",
        sourceId = gift?.id ?? prepaid?.id,
        rate = Math.max(
          1,
          Math.floor(
            (baseRate * (100 - Math.min(90, Math.max(0, discount)))) / 100,
          ),
        ),
        reserve = sourceId ? 0 : Math.ceil(dto.maximumSeconds / 60) * rate;
      const call = await tx.callSession.create({
        data: {
          callerId,
          vendorId: vendor.id,
          callType: dto.callType,
          ratePerMinute: rate,
          reservedAmount: reserve,
          prepaidSeconds: sourceId ? dto.maximumSeconds : 0,
          paymentSourceType: sourceType,
          paymentSourceId: sourceId,
          idempotencyKey: scopedKey,
          status: vendor.autoAcceptCalls ? "ACCEPTED" : "REQUESTED",
        },
      });
      if (reserve > 0)
        await this.wallets.reserve(tx, callerId, reserve, call.id);
      await tx.notification.create({
        data: {
          userId: vendor.userId,
          type: "INCOMING_CALL",
          title: `Incoming ${dto.callType.toLowerCase()} call`,
          body: vendor.autoAcceptCalls ? "A paid call was accepted automatically" : "A user is requesting a paid call",
          data: { callId: call.id, callType: dto.callType },
        },
      });
      return call;
    });
    const vendor = await this.db.vendorProfile.findUnique({
      where: { id: result.vendorId },
    });
    if (vendor) this.realtime.user(vendor.userId, "call:request", result);
    if (result.status === "ACCEPTED") this.realtime.user(result.callerId, "call:accepted", { ...result, rtc: this.rtc.issue(result.id, result.callerId) });
    return result;
  }
  async accept(id: string, userId: string) {
    const call = await this.ownedVendorCall(id, userId);
    if (call.status !== "REQUESTED")
      throw new ConflictException("Call is no longer requestable");
    const updated = await this.db.callSession.update({
        where: { id },
        data: { status: "ACCEPTED" },
      }),
      result = { ...updated, rtc: this.rtc.issue(id, userId) };
    this.realtime.user(call.callerId, "call:accepted", result);
    return result;
  }
  async reject(id: string, userId: string) {
    const call = await this.ownedVendorCall(id, userId);
    if (call.status !== "REQUESTED")
      throw new ConflictException("Call can no longer be rejected");
    const result = await this.release(id, "REJECTED");
    this.realtime.user(call.callerId, "call:rejected", result);
    return result;
  }
  async cancel(id: string, userId: string) {
    const call = await this.db.callSession.findUnique({
      where: { id },
      include: { vendor: true },
    });
    if (!call || call.callerId !== userId) throw new ForbiddenException();
    if (!["REQUESTED", "ACCEPTED", "CONNECTING"].includes(call.status))
      throw new ConflictException("Call can no longer be cancelled");
    const result = await this.release(id, "CANCELLED");
    this.realtime.user(call.vendor.userId, "call:cancelled", result);
    return result;
  }
  async joinToken(id: string, userId: string) {
    const call = await this.assertParticipant(id, userId);
    if (!["ACCEPTED", "CONNECTING", "ACTIVE"].includes(call.status))
      throw new ConflictException("Call cannot be joined");
    await this.db.callParticipantEvent.create({data:{callId:id,userId,eventType:'JOIN_TOKEN_ISSUED'}});
    return { ...this.rtc.issue(id, userId), callType: call.callType,otherUserId:userId===call.callerId?call.vendor.userId:call.callerId,canSendGifts:userId===call.callerId };
  }
  async connected(id: string, userId: string) {
    const call = await this.assertParticipant(id, userId);
    if (!["ACCEPTED", "CONNECTING", "ACTIVE"].includes(call.status))
      throw new ConflictException("Call cannot connect");
    if (call.connectedAt){await this.db.callParticipantEvent.create({data:{callId:id,userId,eventType:'CONNECTED'}});return call;}
    const now = new Date(),
      result = await this.db.callSession.update({
        where: { id },
        data: { status: "ACTIVE", connectedAt: now, lastHeartbeatAt: now },
      });
    await this.db.callParticipantEvent.create({data:{callId:id,userId,eventType:'CONNECTED'}});
    this.realtime.users(
      [call.callerId, call.vendor.userId],
      "call:connected",
      result,
    );
    return result;
  }
  async heartbeat(id: string, userId: string, reportedSeconds: number) {
    const call = await this.assertParticipant(id, userId);
    if (call.status !== "ACTIVE")
      throw new ConflictException("Call is not active");
    const max = this.maximumSeconds(call),
      serverSeconds = call.connectedAt
        ? Math.floor((Date.now() - call.connectedAt.getTime()) / 1000)
        : 0,
      seconds = Math.max(serverSeconds, reportedSeconds);
    await this.db.callSession.update({
      where: { id },
      data: { lastHeartbeatAt: new Date(), lastHeartbeatSeconds: seconds },
    });
    return {
      remainingSeconds: Math.max(0, max - seconds),
      mustEnd: seconds >= max,
    };
  }
  async end(id: string, userId: string, _reportedSeconds?: number, endedBy = userId, disconnectReason?: string, finalStatus: CallStatus = "COMPLETED") {
    await this.assertParticipant(id, userId);
    const result = await this.wallets.transaction(async (tx) => {
      const call = await tx.callSession.findUniqueOrThrow({
        where: { id },
        include: { vendor: { include: { user: true } } },
      });
      if (
        ["COMPLETED", "REJECTED", "CANCELLED", "FAILED", "TERMINATED"].includes(
          call.status,
        )
      )
        return call;
      const duration = call.connectedAt
          ? Math.max(
              0,
              Math.floor((Date.now() - call.connectedAt.getTime()) / 1000),
            )
          : 0,
        settings=await tx.setting.findMany({where:{key:{in:['BILLING_ROUNDING','EARNING_HOLD_DAYS']}},select:{key:true,value:true}}),
        values=Object.fromEntries(settings.map(item=>[item.key,item.value])),
        configuredMethod=typeof values.BILLING_ROUNDING==='object'&&values.BILLING_ROUNDING!==null?(values.BILLING_ROUNDING as Record<string,unknown>).method:undefined,
        method=(['EXACT_SECOND','UP_30_SECONDS','UP_FULL_MINUTE','MINIMUM_ONE_MINUTE'].includes(String(configuredMethod))?configuredMethod:'EXACT_SECOND') as BillingRoundingMethod,
        billed = billableSeconds(duration,this.maximumSeconds(call),method),
        gross = Math.ceil((billed * call.ratePerMinute) / 60),
        vendorAmount = Math.floor(
          (gross * call.vendor.commissionPercent) / 100,
        ),
        platformAmount = gross - vendorAmount;
      if (call.reservedAmount > 0)
        await this.wallets.settleReservation(
          tx,
          call.callerId,
          call.reservedAmount,
          Math.min(call.reservedAmount, gross),
          call.id,
        );
      if (
        call.paymentSourceType === "PACKAGE" &&
        call.paymentSourceId &&
        billed > 0
      )
        await tx.userPackage.update({
          where: { id: call.paymentSourceId },
          data:
            call.callType === "VIDEO"
              ? { remainingVideoSeconds: { decrement: billed } }
              : { remainingVoiceSeconds: { decrement: billed } },
        });
      if (
        call.paymentSourceType === "GIFT_CARD" &&
        call.paymentSourceId &&
        billed > 0
      ) {
        const gift = await tx.userGiftCard.findUniqueOrThrow({
          where: { id: call.paymentSourceId },
        });
        const video =
            gift.remainingVideoSeconds -
            (call.callType === "VIDEO" ? billed : 0),
          voice =
            gift.remainingVoiceSeconds -
            (call.callType === "VOICE" ? billed : 0);
        await tx.userGiftCard.update({
          where: { id: gift.id },
          data: {
            remainingVideoSeconds: video,
            remainingVoiceSeconds: voice,
            status:
              video === 0 && voice === 0 && gift.remainingMessages === 0
                ? "FULLY_USED"
                : "PARTIALLY_USED",
          },
        });
      }
      if (vendorAmount > 0) {
        await this.wallets.creditPendingEarning(
          tx,
          call.vendor.userId,
          vendorAmount,
          call.id,
        );
        await tx.earning.create({
          data: {
            vendorId: call.vendorId,
            callId: call.id,
            sourceType: `${call.callType}_CALL`,
            sourceId: call.id,
            grossAmount: gross,
            vendorAmount,
            platformAmount,
            availableAt: new Date(Date.now() + settingNumber(values.EARNING_HOLD_DAYS,'days',7,0,90) * 86400000),
          },
        });
      }
      await this.wallets.platformCommission(
        tx,
        platformAmount,
        "CALL",
        call.id,
        `${call.callType.toLowerCase()} call commission`,
      );
      await tx.callParticipantEvent.create({data:{callId:id,userId,eventType:'LEFT',metadata:{reportedSeconds:_reportedSeconds??null}}});
      return tx.callSession.update({
        where: { id },
        data: {
          status: finalStatus,
          endedAt: new Date(),
          durationSeconds: duration,
          billedSeconds: billed,
          grossAmount: gross,
          vendorAmount,
          platformAmount,
          endedBy,
          disconnectReason,
        },
        include: { vendor: true },
      });
    });
    const vendorUserId = result.vendor.userId;
    this.realtime.users([result.callerId, vendorUserId], "call:ended", result);
    return result;
  }
  async participantEvent(id:string,userId:string,eventType:string,metadata?:Record<string,unknown>){const call=await this.assertParticipant(id,userId);if(!['ACCEPTED','CONNECTING','ACTIVE'].includes(call.status))throw new ConflictException('Call is not active');return this.db.callParticipantEvent.create({data:{callId:id,userId,eventType,metadata:metadata as Prisma.InputJsonObject|undefined}})}
  async detail(id:string,userId:string){const call=await this.db.callSession.findUnique({where:{id},include:{vendor:{select:{id:true,userId:true,legalName:true,user:{select:{profile:{select:{displayName:true,username:true,avatarUrl:true}}}}}}}});if(!call||(call.callerId!==userId&&call.vendor.userId!==userId))throw new NotFoundException("Call not found");const caller=await this.db.user.findUnique({where:{id:call.callerId},select:{id:true,profile:{select:{displayName:true,username:true,avatarUrl:true}}}});return{...call,caller}}
  async terminateByAdmin(id:string,actorId:string){const call=await this.db.callSession.findUnique({where:{id},select:{callerId:true}});if(!call)throw new NotFoundException("Call not found");return this.end(id,call.callerId,undefined,actorId,"TERMINATED_BY_ADMIN","TERMINATED")}
  async providerEnded(channelName: string) {
    const id = channelName.startsWith("call_")
      ? channelName.slice(5)
      : channelName;
    const call = await this.db.callSession.findUnique({
      where: { id },
      select: { id: true, callerId: true },
    });
    if (!call) throw new NotFoundException("Provider call channel not found");
    return this.end(call.id, call.callerId, undefined, "PROVIDER", "PROVIDER_CHANNEL_ENDED");
  }
  history(userId: string) {
    return this.db.callSession.findMany({
      where: { OR: [{ callerId: userId }, { vendor: { userId } }] },
      include: {
        vendor: { include: { user: { select: { profile: true } } } },
        review: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  private maximumSeconds(call: {
    prepaidSeconds: number;
    reservedAmount: number;
    ratePerMinute: number;
  }) {
    return (
      call.prepaidSeconds ||
      Math.floor((call.reservedAmount / call.ratePerMinute) * 60)
    );
  }
  private async ownedVendorCall(id: string, userId: string) {
    const call = await this.db.callSession.findUnique({
      where: { id },
      include: { vendor: true },
    });
    if (!call || call.vendor.userId !== userId) throw new ForbiddenException();
    return call;
  }
  private async assertParticipant(id: string, userId: string) {
    const call = await this.db.callSession.findUnique({
      where: { id },
      include: { vendor: true },
    });
    if (!call || ![call.callerId, call.vendor.userId].includes(userId))
      throw new ForbiddenException();
    return call;
  }
  private release(
    id: string,
    status: Extract<CallStatus, "REJECTED" | "CANCELLED">,
  ) {
    return this.wallets.transaction(async (tx) => {
      const call = await tx.callSession.findUniqueOrThrow({ where: { id } });
      if (call.reservedAmount > 0)
        await this.wallets.settleReservation(
          tx,
          call.callerId,
          call.reservedAmount,
          0,
          call.id,
        );
      return tx.callSession.update({
        where: { id },
        data: { status, endedAt: new Date() },
      });
    });
  }
}
