import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { CallsModule } from "./calls/calls.module";
import { StaffAccessModule } from "./common/staff-access.module";
import { ChatModule } from "./chat/chat.module";
import { GiftsModule } from "./gifts/gifts.module";
import { GiftCardsModule } from "./gift-cards/gift-cards.module";
import { FilesModule } from "./files/files.module";
import { FraudModule } from "./fraud/fraud.module";
import { HealthModule } from "./health/health.module";
import { JobsModule } from "./jobs/jobs.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { ModerationModule } from "./moderation/moderation.module";
import { MetricsModule } from "./metrics/metrics.module";
import { MetricsInterceptor } from "./metrics/metrics.interceptor";
import { PackagesModule } from "./packages/packages.module";
import { PaymentsModule } from "./payments/payments.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReportsModule } from "./reports/reports.module";
import { RestrictionsModule } from "./restrictions/restrictions.module";
import { EarningsModule } from './earnings/earnings.module';
import { ReferralsModule } from "./referrals/referrals.module";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { SocialModule } from "./social/social.module";
import { SecurityModule } from "./security/security.module";
import { UsersModule } from "./users/users.module";
import { VendorsModule } from "./vendors/vendors.module";
import { WalletModule } from "./wallet/wallet.module";
import { WithdrawalsModule } from "./withdrawals/withdrawals.module";

const validateConfig = (config: Record<string, unknown>) => {
  for (const key of ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"])
    if (!config[key])
      throw new Error(`Missing required environment variable: ${key}`);
  if (
    config.NODE_ENV === "production" &&
    String(config.JWT_ACCESS_SECRET).includes("replace-with")
  )
    throw new Error("Production JWT secrets must be changed");
  if (
    config.NODE_ENV === "production" &&
    (!config.AGORA_APP_ID || !config.AGORA_APP_CERTIFICATE)
  )
    throw new Error(
      "Production RTC requires AGORA_APP_ID and AGORA_APP_CERTIFICATE",
    );
  if (
    config.NODE_ENV === "production" &&
    (!config.AGORA_WEBHOOK_SECRET || !config.AGORA_END_EVENT_TYPES)
  )
    throw new Error(
      "Production RTC requires a signed webhook secret and configured end-event types",
    );
  if (config.NODE_ENV === "production" && !config.PAYOUT_ENCRYPTION_KEY)
    throw new Error("Production withdrawals require PAYOUT_ENCRYPTION_KEY");
  if (config.NODE_ENV === "production" && !config.CORS_ORIGINS)
    throw new Error("Production requires explicit CORS_ORIGINS");
  if (
    config.NODE_ENV === "production" &&
    config.BACKGROUND_QUEUE_MODE !== "bullmq"
  )
    throw new Error("Production requires BACKGROUND_QUEUE_MODE=bullmq");
  if (
    config.NODE_ENV === "production" &&
    (!config.SMS_PROVIDER || config.SMS_PROVIDER === "development")
  )
    throw new Error("Production requires a real SMS_PROVIDER");
  if (
    config.NODE_ENV === "production" &&
    (!config.FILE_SCAN_PROVIDER || config.FILE_SCAN_PROVIDER === "disabled")
  )
    throw new Error("Production requires FILE_SCAN_PROVIDER");
  if (
    [
      config.PERSONA_API_KEY,
      config.PERSONA_TEMPLATE_ID,
      config.PERSONA_WEBHOOK_SECRET,
    ].some(Boolean) &&
    ![
      config.PERSONA_API_KEY,
      config.PERSONA_TEMPLATE_ID,
      config.PERSONA_WEBHOOK_SECRET,
    ].every(Boolean)
  )
    throw new Error(
      "Persona identity verification requires API key, template ID, and webhook secret together",
    );
  return config;
};
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateConfig }),
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          ttl: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
          limit: Number(process.env.RATE_LIMIT_MAX ?? 120),
        },
      ],
    }),
    PrismaModule,
    StaffAccessModule,
    SecurityModule,
    MetricsModule,
    HealthModule,
    JobsModule,
    AuthModule,
    UsersModule,
    SocialModule,
    WalletModule,
    ReferralsModule,
    PaymentsModule,
    VendorsModule,
    PackagesModule,
    SubscriptionsModule,
    GiftsModule,
    GiftCardsModule,
    FilesModule,
    FraudModule,
    WithdrawalsModule,
    ReportsModule,
    RestrictionsModule,
    EarningsModule,
    ReviewsModule,
    ModerationModule,
    NotificationsModule,
    AdminModule,
    CallsModule,
    ChatModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
})
export class AppModule {}
