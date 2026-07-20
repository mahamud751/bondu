import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  imports: [WalletModule],
  controllers: [RewardsController],
  providers: [RewardsService],
})
export class RewardsModule {}
