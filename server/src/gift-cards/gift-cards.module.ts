import { Module } from "@nestjs/common";
import { WalletModule } from "../wallet/wallet.module";
import { GiftCardsController } from "./gift-cards.controller";
import { GiftCardsService } from "./gift-cards.service";
@Module({
  imports: [WalletModule],
  controllers: [GiftCardsController],
  providers: [GiftCardsService],
})
export class GiftCardsModule {}
