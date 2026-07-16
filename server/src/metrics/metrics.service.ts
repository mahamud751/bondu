import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly requests = new Counter({ name: 'socialconnect_http_requests_total', help: 'HTTP requests handled', labelNames: ['method', 'route', 'status'], registers: [this.registry] });
  readonly duration = new Histogram({ name: 'socialconnect_http_request_duration_seconds', help: 'HTTP request duration', labelNames: ['method', 'route', 'status'], buckets: [.01,.025,.05,.1,.25,.5,1,2,5], registers: [this.registry] });
  readonly openReports = new Gauge({ name: 'socialconnect_open_reports', help: 'Open moderation reports', registers: [this.registry] });
  readonly pendingPayments = new Gauge({ name: 'socialconnect_pending_payments', help: 'Payments awaiting review', registers: [this.registry] });
  readonly pendingWithdrawals = new Gauge({ name: 'socialconnect_pending_withdrawals', help: 'Withdrawals awaiting processing', registers: [this.registry] });
  readonly staleCalls = new Gauge({ name: 'socialconnect_stale_active_calls', help: 'Active calls beyond heartbeat timeout', registers: [this.registry] });

  constructor(private readonly db: PrismaService) { collectDefaultMetrics({ register: this.registry, prefix: 'socialconnect_node_' }); }

  async render() {
    const heartbeatCutoff = new Date(Date.now() - Number(process.env.CALL_HEARTBEAT_TIMEOUT_SECONDS ?? 45) * 1000);
    const [reports,payments,withdrawals,calls] = await Promise.all([
      this.db.report.count({where:{status:{in:['OPEN','UNDER_REVIEW']}}}),
      this.db.payment.count({where:{status:{in:['SUBMITTED','UNDER_REVIEW']}}}),
      this.db.withdrawal.count({where:{status:{in:['PENDING','UNDER_REVIEW','APPROVED','PROCESSING']}}}),
      this.db.callSession.count({where:{status:'ACTIVE',OR:[{lastHeartbeatAt:null},{lastHeartbeatAt:{lt:heartbeatCutoff}}]}}),
    ]);
    this.openReports.set(reports); this.pendingPayments.set(payments); this.pendingWithdrawals.set(withdrawals); this.staleCalls.set(calls);
    return this.registry.metrics();
  }
}
