import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CallsService } from '../calls/calls.service';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class CallExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CallExpiryService.name); private timer?: ReturnType<typeof setInterval>; private running = false;
  constructor(private readonly db: PrismaService, private readonly calls: CallsService, private readonly config: ConfigService) {}
  onModuleInit() { if (this.config.get('DISABLE_BACKGROUND_JOBS') === 'true' || this.config.get('BACKGROUND_QUEUE_MODE') === 'bullmq') return; this.timer = setInterval(() => void this.expire(), 5000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async expire() { if (this.running) return; this.running = true; try { const timeout = Number(this.config.get('CALL_HEARTBEAT_TIMEOUT_SECONDS') ?? 45), now = Date.now(); const active = await this.db.callSession.findMany({ where: { status: 'ACTIVE' }, take: 200 }); for (const call of active) { const max = call.prepaidSeconds || Math.floor(call.reservedAmount / call.ratePerMinute * 60), elapsed = call.connectedAt ? Math.floor((now - call.connectedAt.getTime()) / 1000) : 0, stale = call.lastHeartbeatAt ? (now - call.lastHeartbeatAt.getTime()) / 1000 > timeout : elapsed > timeout; if (elapsed >= max || stale) { try { await this.db.callSession.update({ where: { id: call.id }, data: { disconnectReason: elapsed >= max ? 'ALLOWANCE_EXHAUSTED' : 'HEARTBEAT_TIMEOUT' } }); await this.calls.end(call.id, call.callerId); } catch (error) { this.logger.error(`Failed to expire call ${call.id}`, error); } } } } finally { this.running = false; } }
}
