# SocialConnect MVP

Two-project foundation for the paid social platform:

- `app/` — React Native CLI TypeScript mobile client
- `server/` — NestJS, Prisma and PostgreSQL API

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

Set the real merchant/personal receiver numbers in `server/.env`. Users send money outside the app, then submit gateway, sender number, exact integer BDT amount, and transaction ID. Transaction IDs are unique. A submission remains pending until an `ADMIN` or `FINANCE` account approves it. Approval atomically credits points and creates an immutable ledger record. Never expose database/admin credentials in the app.

## Run the mobile app

The TypeScript application source is complete under `app/src`. Generate the platform-native React Native CLI shells once, preserving `src`, `package.json`, and configs, or initialize this folder with React Native Community CLI. Then:

```bash
cd app
npm install
npm run android
```

Android emulator uses `http://10.0.2.2:3000`; change `app/src/api/client.ts` for a physical device or iOS simulator.

The development seed creates an administrator using `SEED_ADMIN_PHONE` and `SEED_ADMIN_PASSWORD`. The example values are `01900000000` and `Admin123!`; change them outside local development.

## Implemented foundation

The runnable local MVP includes:

- registration and development OTP verification, login, rotating device sessions, and automatic token refresh;
- profiles, vendor applications/review, discovery, availability, blocking, and reporting;
- paid chat, read state, notifications, call request/accept/reject/cancel/connect/end lifecycle, and server-authoritative billing;
- wallet ledger, bKash/Nagad deposit review, prepaid voice/chat packages, vendor earnings, gifts, and withdrawal review;
- role-protected mobile administration for payments, vendors, and withdrawals, plus full moderation/settings APIs in Swagger;
- a deterministic initial PostgreSQL migration, catalog/admin seed, health endpoint, Docker services, and wallet accounting tests.

The mobile client includes phone registration with OTP verification, persistent device sessions, automatic access-token renewal, and safe sign-out when a session can no longer be refreshed. In local development the OTP is returned by the API and displayed by the app; production intentionally omits it and requires an SMS adapter.

## External services required for production

Local flows are complete without paid services. Real audio transport, SMS delivery, push delivery, and identity-document storage cannot be activated responsibly without choosing providers and supplying their credentials. The current call lifecycle and billing can be exercised locally, but the generated development join token is not a substitute for an Agora/Twilio/WebRTC media provider. Chat uses five-second polling so it works without Redis or a socket gateway.

Before a public launch, set strong JWT secrets and real receiver numbers, replace the development OTP response with an SMS adapter, connect an RTC provider and native client SDK, configure push/object storage, add rate limiting and monitoring, and expand the accounting/security test suite.

## Verification

```bash
cd server && npm test
cd ../app && npm run typecheck
```

Check a running API at `GET http://localhost:3000/api/v1/health`.
