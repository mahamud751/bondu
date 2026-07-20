import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

const DAILY_REWARD_AMOUNT = 20;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RewardsService {
  constructor(private readonly db: PrismaService, private readonly wallets: WalletService) {}

  async dailyStatus(userId: string) {
    const last = await this.db.dailyRewardClaim.findFirst({ where: { userId }, orderBy: { claimedAt: 'desc' } });
    const nextClaimAt = last ? new Date(last.claimedAt.getTime() + COOLDOWN_MS) : null;
    const claimable = !nextClaimAt || nextClaimAt <= new Date();
    return { claimable, amount: DAILY_REWARD_AMOUNT, nextClaimAt: claimable ? null : nextClaimAt!.toISOString() };
  }

  async claimDaily(userId: string) {
    const last = await this.db.dailyRewardClaim.findFirst({ where: { userId }, orderBy: { claimedAt: 'desc' } });
    if (last && last.claimedAt.getTime() + COOLDOWN_MS > Date.now()) throw new ConflictException('Daily reward already claimed');
    const claim = await this.wallets.transaction(async tx => {
      const created = await tx.dailyRewardClaim.create({ data: { userId, amount: DAILY_REWARD_AMOUNT } });
      await this.wallets.creditPromotional(tx, { userId, type: 'PROMOTIONAL_BONUS', direction: 'CREDIT', amount: DAILY_REWARD_AMOUNT, referenceType: 'DAILY_REWARD', referenceId: created.id, description: 'Daily reward claim', idempotencyKey: `daily-reward:${created.id}` });
      return created;
    });
    return { claimed: true, amount: claim.amount };
  }
}
