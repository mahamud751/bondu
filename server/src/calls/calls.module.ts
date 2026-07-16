import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { RtcModule } from "../rtc/rtc.module";
import { RtcWebhookController } from "../rtc/rtc-webhook.controller";
import { RtcWebhookService } from "../rtc/rtc-webhook.service";
import { WalletModule } from "../wallet/wallet.module";
import { CallsController } from "./calls.controller";
import { CallsService } from "./calls.service";
@Module({
  imports: [WalletModule, RealtimeModule, RtcModule],
  controllers: [CallsController, RtcWebhookController],
  providers: [CallsService, RtcWebhookService],
  exports: [CallsService],
})
export class CallsModule {}
