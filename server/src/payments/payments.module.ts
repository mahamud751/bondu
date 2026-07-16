import { Module } from "@nestjs/common";
import { ReferralsModule } from "../referrals/referrals.module";
import { WalletModule } from "../wallet/wallet.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { SslCommerzService } from "./sslcommerz.service";
@Module({
  imports: [WalletModule, ReferralsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, SslCommerzService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
