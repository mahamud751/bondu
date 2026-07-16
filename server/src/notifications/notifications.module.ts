import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { SmsModule } from '../sms/sms.module';
import { EmailModule } from './email.module';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { NotificationsController } from './notifications.controller';
@Module({ imports: [RealtimeModule, SmsModule, EmailModule], controllers: [NotificationsController], providers: [NotificationDispatcher], exports: [NotificationDispatcher] })
export class NotificationsModule {}
