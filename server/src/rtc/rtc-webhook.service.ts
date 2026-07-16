import { createHmac, timingSafeEqual } from "crypto";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { CallsService } from "../calls/calls.service";
import { PrismaService } from "../prisma/prisma.service";

type AgoraNotice = {
  noticeId?: string;
  eventType?: number | string;
  notifyMs?: number;
  payload?: Record<string, unknown>;
};

@Injectable()
export class RtcWebhookService {
  constructor(
    private readonly config: ConfigService,
    private readonly db: PrismaService,
    private readonly calls: CallsService,
  ) {}
  verify(rawBody: Buffer, signature?: string) {
    const secret = this.config.get<string>("AGORA_WEBHOOK_SECRET");
    if (!secret || !signature)
      throw new ForbiddenException("Missing RTC webhook signature");
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex"),
      supplied = signature.trim().toLowerCase();
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    )
      throw new ForbiddenException("Invalid RTC webhook signature");
  }
  async receive(notice: AgoraNotice) {
    const eventId = String(notice.noticeId ?? ""),
      eventType = String(notice.eventType ?? "");
    if (!eventId || !eventType)
      throw new ForbiddenException("Invalid RTC webhook event");
    const payload = notice.payload ?? {},
      channelName = this.channel(payload);
    const event = await this.db.rtcWebhookEvent.upsert({
      where: { provider_eventId: { provider: "AGORA", eventId } },
      create: {
        provider: "AGORA",
        eventId,
        eventType,
        channelName,
        payload: notice as Prisma.InputJsonValue,
      },
      update: {},
    });
    if (event.processedAt) return { accepted: true, duplicate: true };
    try {
      const endEvents = new Set(
        (this.config.get<string>("AGORA_END_EVENT_TYPES") ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      );
      if (endEvents.has(eventType)) {
        if (!channelName)
          throw new Error("RTC end event did not include a channel name");
        await this.calls.providerEnded(channelName);
      }
      await this.db.rtcWebhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date(), error: null },
      });
      return { accepted: true, duplicate: false };
    } catch (error) {
      await this.db.rtcWebhookEvent.update({
        where: { id: event.id },
        data: {
          error:
            error instanceof Error
              ? error.message.slice(0, 1000)
              : "Processing failed",
        },
      });
      throw error;
    }
  }
  private channel(payload: Record<string, unknown>) {
    const value = payload.channelName ?? payload.channel ?? payload.cname;
    return typeof value === "string" && value.length <= 255 ? value : null;
  }
}
