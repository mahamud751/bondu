import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SmsService } from '../sms/sms.service';
import { EmailService } from './email.service';

const SECURITY_SMS_TYPES = new Set([
  'SUSPICIOUS_LOGIN',
  'PASSWORD_CHANGED',
  'ACCOUNT_WARNING',
  'ACCOUNT_SUSPENDED',
  'WITHDRAWAL_APPROVED',
  'WITHDRAWAL_REJECTED',
]);

@Injectable()
export class NotificationDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDispatcher.name); private timer?: ReturnType<typeof setInterval>; private messaging?: Messaging; private running = false;
  constructor(private readonly db: PrismaService, private readonly config: ConfigService, private readonly realtime: RealtimeGateway, private readonly email: EmailService, private readonly sms: SmsService) {
    const projectId = config.get<string>('FIREBASE_PROJECT_ID'), clientEmail = config.get<string>('FIREBASE_CLIENT_EMAIL'), privateKey = config.get<string>('FIREBASE_PRIVATE_KEY')?.replaceAll('\\n', '\n');
    if (projectId && clientEmail && privateKey) { const app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }); this.messaging = getMessaging(app); }
  }
  onModuleInit() { if (this.config.get('DISABLE_BACKGROUND_JOBS') === 'true' || this.config.get('BACKGROUND_QUEUE_MODE') === 'bullmq') return; this.timer = setInterval(() => void this.dispatchPending(), 10_000); this.timer.unref(); void this.dispatchPending(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async dispatchPending(limit = 100) {
    if (this.running) return { processed: 0, skipped: true }; this.running = true;
    try { const pending = await this.db.notification.findMany({ where: { dispatchedAt: null }, orderBy: { createdAt: 'asc' }, take: limit }); let processed = 0; for (const notification of pending) { try { await this.dispatch(notification); processed++; } catch (error) { this.logger.error(`Notification ${notification.id} failed`, error); } } return { processed, examined: pending.length }; }
    finally { this.running = false; }
  }
  private async dispatch(notification: { id: string; userId: string; type: string; title: string; body: string; data: unknown }) {
    const preference = await this.db.notificationPreference.findUnique({ where: { userId: notification.userId } });
    const user = await this.db.user.findUnique({ where: { id: notification.userId }, select: { email: true, phone: true } });
    const muted = preference?.mutedTypes.includes(notification.type) ?? false;
    const quiet = this.inQuietHours(preference?.quietStart, preference?.quietEnd);
    this.realtime.user(notification.userId, 'notification:new', notification);
    await this.db.notificationDelivery.create({ data: { notificationId: notification.id, channel: 'IN_APP', status: 'DELIVERED' } });
    if (this.messaging && preference?.pushEnabled !== false && !muted && !quiet) {
      const tokens = await this.db.pushToken.findMany({ where: { userId: notification.userId, active: true } });
      if (tokens.length) {
        const response = await this.messaging.sendEachForMulticast({ tokens: tokens.map(item => item.token), notification: { title: notification.title, body: notification.body }, data: Object.fromEntries(Object.entries((notification.data ?? {}) as Record<string, unknown>).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])), android: { priority: notification.type === 'INCOMING_CALL' ? 'high' : 'normal' }, apns: { payload: { aps: { sound: 'default', contentAvailable: true } } } });
        await Promise.all(response.responses.map((item, index) => this.db.notificationDelivery.create({ data: { notificationId: notification.id, channel: 'PUSH', destination: tokens[index].id, status: item.success ? 'DELIVERED' : 'FAILED', providerId: item.messageId, error: item.error?.message } })));
        const invalid = response.responses.flatMap((item, index) => !item.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(item.error?.code ?? '') ? [tokens[index].id] : []);
        if (invalid.length) await this.db.pushToken.updateMany({ where: { id: { in: invalid } }, data: { active: false } });
      }
    }
    if (user?.email && this.email.configured() && preference?.emailEnabled !== false && !muted && !quiet) {
      await this.deliver(notification.id, 'EMAIL', user.email, () => this.email.send(user.email!, notification.title, notification.body));
    }
    if (user?.phone && preference?.smsSecurity !== false && SECURITY_SMS_TYPES.has(notification.type)) {
      await this.deliver(notification.id, 'SMS', user.phone, () => this.sms.sendTransactional(user.phone, `${notification.title}: ${notification.body}`));
    }
    await this.db.notification.update({ where: { id: notification.id }, data: { dispatchedAt: new Date() } });
  }

  private async deliver(notificationId:string,channel:string,destination:string,send:()=>Promise<unknown>) {
    try {
      const result=await send();
      const providerId=typeof result==='object'&&result!==null&&'providerId'in result&&typeof result.providerId==='string'?result.providerId:undefined;
      await this.db.notificationDelivery.create({data:{notificationId,channel,destination,status:'DELIVERED',providerId}});
    } catch(error) {
      const message=error instanceof Error?error.message:'Delivery failed';
      await this.db.notificationDelivery.create({data:{notificationId,channel,destination,status:'FAILED',error:message}});
      this.logger.warn(`${channel} delivery failed for notification ${notificationId}: ${message}`);
    }
  }

  private inQuietHours(start?:string|null,end?:string|null,now=new Date()) {
    if(!start||!end||!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end))return false;
    const current=now.getHours()*60+now.getMinutes();
    const value=(input:string)=>{const[hour,minute]=input.split(':').map(Number);return hour*60+minute};
    const from=value(start),to=value(end);
    if(from===to)return false;
    return from<to?current>=from&&current<to:current>=from||current<to;
  }
}
