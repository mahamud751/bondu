import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { SubscriptionsController } from './subscriptions.controller';
@Module({ imports: [WalletModule], controllers: [SubscriptionsController] })
export class SubscriptionsModule {}
