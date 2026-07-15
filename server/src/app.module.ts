import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CallsModule } from './calls/calls.module';
import { ChatModule } from './chat/chat.module';
import { GiftsModule } from './gifts/gifts.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PackagesModule } from './packages/packages.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { SocialModule } from './social/social.module';
import { UsersModule } from './users/users.module';
import { VendorsModule } from './vendors/vendors.module';
import { WalletModule } from './wallet/wallet.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';

const validateConfig = (config: Record<string, unknown>) => {
  for (const key of ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) if (!config[key]) throw new Error(`Missing required environment variable: ${key}`);
  if (config.NODE_ENV === 'production' && String(config.JWT_ACCESS_SECRET).includes('replace-with')) throw new Error('Production JWT secrets must be changed');
  return config;
};
@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateConfig }), PrismaModule, HealthModule, AuthModule, UsersModule, SocialModule, WalletModule, PaymentsModule, VendorsModule, PackagesModule, GiftsModule, WithdrawalsModule, ReportsModule, NotificationsModule, AdminModule, CallsModule, ChatModule] })
export class AppModule {}
