import {
  Body,
  Controller,
  Headers,
  Post,
  RawBodyRequest,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { RtcWebhookService } from "./rtc-webhook.service";
@ApiTags("RTC webhooks")
@Controller("rtc/webhooks")
export class RtcWebhookController {
  constructor(private readonly webhooks: RtcWebhookService) {}
  @Post("agora") agora(
    @Req() request: RawBodyRequest<Request>,
    @Headers("agora-signature-v2") signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    if (!request.rawBody) throw new Error("Raw request body is unavailable");
    this.webhooks.verify(request.rawBody, signature);
    return this.webhooks.receive(body);
  }
}
