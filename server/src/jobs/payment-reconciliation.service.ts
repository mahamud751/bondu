import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class PaymentReconciliationWorker implements OnModuleInit,OnModuleDestroy {
  private timer?:ReturnType<typeof setInterval>;
  constructor(private readonly payments:PaymentsService,private readonly config:ConfigService){}
  onModuleInit(){if(this.config.get('DISABLE_BACKGROUND_JOBS')==='true'||this.config.get('BACKGROUND_QUEUE_MODE')==='bullmq')return;const interval=Math.max(3600000,Number(this.config.get('PAYMENT_RECONCILIATION_INTERVAL_MS')??86400000));this.timer=setInterval(()=>void this.payments.reconcileStripe(500),interval);this.timer.unref()}
  onModuleDestroy(){if(this.timer)clearInterval(this.timer)}
}
