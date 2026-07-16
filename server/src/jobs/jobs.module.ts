import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { CallsModule } from '../calls/calls.module';
import { PaymentsModule } from '../payments/payments.module';
import { JobsController } from './jobs.controller';
import { EarningReleaseService } from './earning-release.service';
import { CallExpiryService } from './call-expiry.service';
import { PaymentReconciliationWorker } from './payment-reconciliation.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { DurableJobsService } from './durable-jobs.service';

@Module({ imports: [WalletModule, CallsModule,PaymentsModule,NotificationsModule], controllers: [JobsController], providers: [EarningReleaseService, CallExpiryService,PaymentReconciliationWorker,DurableJobsService], exports: [EarningReleaseService,DurableJobsService] })
export class JobsModule {}
