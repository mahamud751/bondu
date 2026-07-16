# SocialConnect MVP

> The repository is an MVP foundation, not the complete production platform. See [the implementation status](documentation/IMPLEMENTATION_STATUS.md) for the audited feature matrix and launch blockers.

Two-project foundation for the paid social platform:

- `app/` — React Native CLI TypeScript mobile client
- `server/` — NestJS, Prisma and PostgreSQL API
- `admin/` — Next.js operations console for Admin, Finance and Trust & Safety

## Run the server

```bash
docker compose up -d
cd server
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run start:dev
```

Swagger is available at `http://localhost:3000/docs`; API routes use `/api/v1`.

Set the real merchant/personal receiver numbers in `server/.env`. Users choose a point quantity, send the exact BDT amount calculated from the active conversion snapshot, then submit gateway, sender number and transaction ID. Transaction IDs are unique. A submission remains pending until an `ADMIN` or `FINANCE` account approves it. Approval atomically credits the snapshotted point quantity and creates an immutable ledger record. Never expose database/admin credentials in the app.

## Run the mobile app

The TypeScript application source is complete under `app/src`. Generate the platform-native React Native CLI shells once, preserving `src`, `package.json`, and configs, or initialize this folder with React Native Community CLI. Then:

```bash
cd app
npm install
npm run android
```

Android native builds require JDK 17 or newer. Agora, Firebase and Stripe native packages are linked by React Native; add your Firebase `google-services.json` / `GoogleService-Info.plist` files for push delivery.

Authentication supports Bangladesh phone OTP, verified email/password, Google and Apple. Production email verification uses either Resend or the signed generic email webhook configured in `server/.env`; development exposes the generated code only when `NODE_ENV` is not `production`.

Android emulator uses `http://10.0.2.2:3000`; change `app/src/api/client.ts` for a physical device or iOS simulator.

## Run the admin console

```bash
cd admin
cp .env.example .env.local
npm install
npm run dev
```

The operations console is available at `http://localhost:3001` when using Docker Compose, or the URL shown by Next.js in local development.

The development seed creates Admin (`01900000000` / `Admin123!`), Moderator (`01810000005` / `Staff123!`), Finance (`01810000006` / `Staff123!`), creator and member accounts, plus catalogs, schedules, social relationships, chat, notifications and support history. All credentials can be overridden with seed environment variables and must be changed outside local development.

Production also requires a dedicated 32-byte `PAYOUT_ENCRYPTION_KEY` (base64 or 64-character hex). Withdrawal account numbers are encrypted with AES-256-GCM, masked in normal responses, and every privileged reveal is audit-logged.

## Implemented foundation

The runnable local MVP includes:

- registration and development OTP verification, login, rotating device sessions, and automatic token refresh;
- profiles, vendor applications/review, discovery, availability, blocking, and reporting;
- paid chat, read state, notifications, call request/accept/reject/cancel/connect/end lifecycle, and server-authoritative billing;
- wallet ledger, bKash/Nagad deposit review, Stripe checkout/refunds/reconciliation, voice/video/chat packages, memberships, referrals, vendor earnings, gifts, and withdrawal review;
- role-protected mobile administration for payments, vendors, and withdrawals, plus full moderation/settings APIs in Swagger;
- deterministic PostgreSQL migrations, comprehensive catalog/admin/demo seed data, database-enforced financial constraints, health/metrics endpoints, Docker services, and wallet/accounting tests.

The mobile client includes phone registration with OTP verification, persistent device sessions, automatic access-token renewal, and safe sign-out when a session can no longer be refreshed. In local development the OTP is returned by the API and displayed by the app; production requires either the Twilio adapter or a signed generic SMS webhook and never returns the code.

Google and Apple native sign-in configuration and server-verification requirements are documented in [documentation/AUTH_PROVIDERS.md](documentation/AUTH_PROVIDERS.md).

## External services required for production

Local flows are complete without paid services. Real audio transport, SMS delivery, push delivery, and identity-document storage require provider credentials. The server issues genuine Agora RTC tokens when `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` are configured and clearly reports development mode otherwise. Configure `AGORA_WEBHOOK_SECRET` and the project’s `AGORA_END_EVENT_TYPES` to enable raw-body HMAC-v2 verified, idempotent provider settlement callbacks. Chat and presence use an authenticated Socket.IO gateway.

Before a public launch, set strong JWT secrets and real receiver numbers, configure the SMS/email adapters, connect live RTC callbacks and physical-device native SDKs, configure push/object storage/scanning, validate monitoring/off-site backups, and complete legal and store compliance.

## Verification

```bash
cd server && npm test
cd ../app && npm run typecheck
```

For real database concurrency verification, apply migrations and seed to a disposable PostgreSQL database, then run `INTEGRATION_DATABASE_URL=postgresql://… npm run test:integration` from `server/`.

Check a running API at `GET http://localhost:3000/api/v1/health`.

Production probes, Prometheus metrics, the optional Grafana/Loki stack, and recommended alerts are documented in [documentation/OPERATIONS.md](documentation/OPERATIONS.md).

The GitHub Actions pipeline validates and applies every Prisma migration to a fresh PostgreSQL 16 database, executes the full seed, runs backend tests, type-checks the mobile client, and production-builds the admin console.
