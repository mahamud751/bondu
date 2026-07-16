import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class EarningReleaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EarningReleaseService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(private readonly db: PrismaService, private readonly wallets: WalletService, private readonly config: ConfigService) {}

  onModuleInit() {
    if (this.config.get('DISABLE_BACKGROUND_JOBS') === 'true' || this.config.get('BACKGROUND_QUEUE_MODE') === 'bullmq') return;
    const interval = Math.max(30_000, Number(this.config.get('EARNING_RELEASE_INTERVAL_MS') ?? 300_000));
    this.timer = setInterval(() => void this.releaseDue(), interval);
    this.timer.unref();
    void this.releaseDue();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async releaseDue(limit = 100) {
    if (this.running) return { processed: 0, skipped: true };
    this.running = true;
    try {
      const due = await this.db.earning.findMany({ where: { status: 'PENDING', availableAt: { lte: new Date() } }, select: { id: true }, orderBy: { availableAt: 'asc' }, take: Math.min(limit, 500) });
      let processed = 0;
      for (const item of due) {
        try {
          const released = await this.wallets.transaction(async tx => {
            const earning = await tx.earning.findUnique({ where: { id: item.id }, include: { vendor: true } });
            if (!earning || earning.status !== 'PENDING' || earning.availableAt > new Date()) return false;
            const claimed = await tx.earning.updateMany({ where: { id: earning.id, status: 'PENDING' }, data: { status: 'AVAILABLE' } });
            if (claimed.count !== 1) return false;
            await this.wallets.makeEarningAvailable(tx, earning.vendor.userId, earning.vendorAmount, earning.id);
            return true;
          });
          if (released) processed++;
        } catch (error) { this.logger.error(`Failed to release earning ${item.id}`, error); }
      }
      return { processed, examined: due.length };
    } finally { this.running = false; }
  }
}
