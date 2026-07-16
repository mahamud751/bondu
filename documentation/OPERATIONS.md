# SocialConnect operations

## Health and metrics

- `GET /api/v1/health/live` verifies the Node process is responsive.
- `GET /api/v1/health/ready` verifies PostgreSQL connectivity and reports query latency.
- `GET /api/v1/metrics` exposes Prometheus metrics. When `METRICS_TOKEN` is set, scrapers must send it in `x-metrics-token`.

Metrics include request count/latency, Node runtime health, pending payments and withdrawals, open reports, and stale active calls. Route labels use registered templates rather than IDs to avoid high-cardinality metrics.

Socket.IO automatically uses Redis pub/sub when `REDIS_URL` is configured, allowing events and user rooms to span API instances. Development falls back to the in-memory adapter if Redis is unavailable; production fails startup rather than silently losing cross-instance delivery. Set `CORS_ORIGINS` to a comma-separated allowlist in production.

Production requires `BACKGROUND_QUEUE_MODE=bullmq`. Call expiry, notification dispatch, earning release, and payment reconciliation then run as repeatable Redis-backed jobs with five exponential-backoff attempts. Failed jobs are retained for up to 30 days (maximum 5,000) and can be inspected or retried through the protected `/api/v1/admin/jobs/status` and `/api/v1/admin/jobs/retry-failed` operations. `inline` remains available for dependency-light local development only.

## Local observability stack

Start the application and the optional monitoring profile:

```bash
GRAFANA_ADMIN_PASSWORD='replace-this' docker compose --profile observability up -d
```

Grafana is available on port `3002`, Prometheus on `9090`, and Loki on `3100`. Grafana provisions Prometheus/Loki data sources and the **SocialConnect Operations** dashboard automatically. Promtail reads Docker container logs through the Docker socket; restrict access to that socket in hosted environments.

The bundled Prometheus configuration assumes `METRICS_TOKEN` is empty on the private Compose network. For production, set a strong token and configure the external scraper to send the matching header.

## TLS reverse proxy and backups

The `production` Compose profile adds Nginx and scheduled PostgreSQL backups. Supply deployment-managed certificates named `fullchain.pem` and `privkey.pem` through `TLS_CERT_DIR`, and set a strong `POSTGRES_PASSWORD` before first database initialization:

```bash
TLS_CERT_DIR=/run/secrets/socialconnect-tls \
POSTGRES_PASSWORD='replace-this' \
FILE_SCAN_PROVIDER=clamav \
docker compose --profile production up -d
```

Nginx redirects HTTP to HTTPS, proxies `/api` and `/realtime`, supports WebSocket upgrades, limits API bursts, enforces a 26 MB upload ceiling, and adds HSTS and baseline browser-security headers. TLS private keys are ignored by Git and must remain read-only deployment secrets.

The backup container creates daily compressed PostgreSQL dumps in the `postgres_backups` volume. Defaults retain seven daily, four weekly, and six monthly backups; tune them with `BACKUP_SCHEDULE`, `BACKUP_KEEP_DAYS`, `BACKUP_KEEP_WEEKS`, and `BACKUP_KEEP_MONTHS`.

For disaster recovery, enable the optional `offsite-backup` profile. It uses rclone crypt to encrypt dump contents and object names before synchronizing to an S3-compatible bucket, then verifies the remote copy. Keep all credentials in the deployment secret manager:

```bash
BACKUP_S3_PROVIDER=Other \
BACKUP_S3_ENDPOINT=https://s3.example.com \
BACKUP_S3_ACCESS_KEY_ID='secret-managed' \
BACKUP_S3_SECRET_ACCESS_KEY='secret-managed' \
BACKUP_S3_BUCKET=socialconnect-backups \
BACKUP_CRYPT_PASSWORD='secret-managed' \
BACKUP_CRYPT_SALT='secret-managed' \
docker compose --profile production --profile offsite-backup up -d
```

Use a bucket in a separate failure domain with versioning, object lock and lifecycle retention. Restrict its key to that bucket. A successful sync is not a restore test; alert on container failure and perform the disposable-database restore drill below at least quarterly.

Test restoration regularly in a disposable database. After stopping write traffic, select a verified dump and restore using the PostgreSQL client version matching production:

```bash
gunzip -c socialconnect.sql.gz | psql "$DATABASE_URL"
```

Never restore over a live database. Verify the checksum, restore into a fresh database, run application smoke tests and wallet reconciliation, then switch traffic.

## Upload quarantine and malware scanning

Production requires `FILE_SCAN_PROVIDER=clamav`. New uploads remain inaccessible and cannot be attached to profiles, KYC, reports, support, or chat until ClamAV returns a clean result. Detected files are marked rejected and removed from storage; scanner failures remain quarantined for Admin/Moderator review and retry through `/api/v1/files/admin/scan-queue` and `/api/v1/files/admin/:id/rescan`.

The production Compose profile includes a ClamAV daemon and persistent signature database. Monitor signature freshness, scan failures, quarantine age, and daemon health. `FILE_SCAN_PROVIDER=disabled` is accepted only outside production and is recorded as a development bypass on each asset.

## Minimum production alerts

- API 5xx rate above 1% for five minutes.
- p95 API latency above 500 ms for ten minutes.
- Any stale active call for longer than two heartbeat windows.
- Pending payment or withdrawal queue growing continuously for 30 minutes.
- Payment reconciliation mismatch count above zero.
- PostgreSQL readiness failure, repeated process restart, or disk usage above 80%.
- No successful database backup within 24 hours.

## Secrets and retention

Never put production secrets in Compose files. Use the deployment secret manager for JWT, payout encryption, payment, Agora, Firebase, storage, and metrics credentials. Restrict Grafana and Prometheus to the operations network. Configure log retention according to privacy policy and avoid logging OTP codes, tokens, KYC data, payout accounts, chat contents, or signed URLs.

## Outbound notification providers

Firebase credentials enable push delivery. Set `EMAIL_PROVIDER=resend` with `RESEND_API_KEY` and `EMAIL_FROM`, or use `EMAIL_PROVIDER=webhook` with `EMAIL_WEBHOOK_URL` and `EMAIL_WEBHOOK_SECRET`. Webhook email requests include a timestamp and an HMAC-SHA256 signature over the exact JSON request body. SMS uses the configured Twilio or signed-webhook adapter. In-app delivery is always attempted; muted types and quiet hours suppress nonessential push/email delivery, while explicitly enabled security SMS is reserved for account and withdrawal events. Provider attempts are recorded in `NotificationDelivery` for operations review.
