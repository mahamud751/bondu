import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { LiveModule } from '../live/live.module';
import { EngagementModule } from '../engagement/engagement.module';
import { GiftsController } from './gifts.controller';

@Module({
  imports: [WalletModule, RealtimeModule, LiveModule, EngagementModule],
  controllers: [GiftsController],
})
export class GiftsModule {}
