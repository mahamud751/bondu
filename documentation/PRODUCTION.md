# Production deployment checklist

> SSLCommerz and Twilio are **optional / not required** for this product path.

## Stack

```bash
docker compose up -d postgres redis api worker admin
# optional observability:
docker compose --profile observability up -d
```

Services:
- `api` — NestJS on `:3000`
- `worker` — BullMQ background jobs
- `admin` — Next ops console on `:3001`
- `postgres` / `redis`

## Required env (`server/.env`)

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Postgres connection |
| `REDIS_URL` | Redis for Socket.IO + BullMQ |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Strong random secrets |
| `PAYOUT_ENCRYPTION_KEY` | 32-byte key for withdrawal accounts |
| `CORS_ORIGINS` | Comma-separated app/admin origins |
| `BACKGROUND_QUEUE_MODE=bullmq` | Production workers |
| `AGORA_APP_ID` / `AGORA_APP_CERTIFICATE` | Real RTC |
| `AGORA_WEBHOOK_SECRET` | Optional settlement webhooks |
| Firebase / S3 / ClamAV / Persona | Optional advanced |

## Deploy steps

1. Set secrets (never commit).
2. `docker compose build && docker compose up -d`
3. `docker compose exec api npx prisma migrate deploy`
4. Seed **once**, then change all passwords.
5. Point mobile `API_URL` to `https://api.yourdomain.com/api/v1`
6. TLS via Nginx (`docker/nginx/socialconnect.conf`)
7. Verify `GET /api/v1/health/ready`
8. Backup cron + restore drill (`docker/offsite-backup.sh`)

## Mobile production

- Release APK/AAB with production API URL
- Firebase `google-services.json` / `GoogleService-Info.plist`
- Physical device test: live, beauty, multi-guest, PK, gifts FX

## Feature flags (runtime)

- Beauty uses Agora `setBeautyEffectOptions`
- Virtual Live hides camera; shows **3D-style VTuber** avatar
- Translate uses glossary + MyMemory free API (best-effort)
- Draw & Guess uses **path draw engine**
- Gift FX supports **tier packs + animationUrl (SVGA/GIF slot)**

## Global scale

See [GLOBAL_SCALE.md](./GLOBAL_SCALE.md) and `docker/nginx/socialconnect-scale.conf`.
