# Global scale playbook

SocialConnect is designed for **horizontal scale** of the API + worker, with shared Postgres and Redis.

## Architecture

```
Clients (app)
   │ HTTPS + WSS
   ▼
Edge Nginx (TLS, rate limit, least_conn)
   │
   ├─► API replica 1 ─┐
   ├─► API replica 2 ─┼─► Redis (Socket.IO adapter + BullMQ)
   └─► API replica N ─┘         │
                                 ▼
                         Postgres primary
                                 │
                         (optional read replica)
Worker replicas ──► Redis queues ──► Postgres
CDN (Cloudflare/R2) ──► gift FX packs / media
Agora ──► media plane (not your servers)
```

## Why this works

| Concern | Solution already in codebase |
| --- | --- |
| Multi-node websockets | Redis Socket.IO adapter |
| Background jobs | BullMQ workers (`BACKGROUND_PROCESS_ROLE=worker`) |
| Stateless API | JWT + DB; scale with `docker compose up --scale api=3` |
| Media load | Agora carries A/V; gifts/FX are lightweight URLs |
| Edge abuse | Nginx `limit_req` / `limit_conn` |

## Scale steps

1. **Vertical first:** size Postgres (connections, indexes) and Redis memory.
2. **API replicas:**  
   ```bash
   docker compose up -d --scale api=3 worker=2
   ```
3. Use `docker/nginx/socialconnect-scale.conf` with an upstream list.
4. Put **Cloudflare** (or similar) in front for CDN + DDoS.
5. Host gift `animationUrl` packs on **R2/S3 + CDN**.
6. Set `CORS_ORIGINS` and production JWT secrets.
7. Run workers separately from API (`BACKGROUND_PROCESS_ROLE`).
8. Metrics: Prometheus profile + alert on p95 latency / queue depth.

## Regional expansion

- **Phase A:** One region (Singapore/Mumbai) + CDN global.
- **Phase B:** Second region API + Redis, sticky DNS latency routing.
- **Phase C:** Postgres primary + read replicas; keep writes in one region.

Agora already distributes media globally; your backend only needs low-latency signaling/API.

## Capacity targets (rough)

| Tier | API | Worker | Postgres | Concurrent lives |
| --- | --- | --- | --- | --- |
| Beta | 1–2 | 1 | 2 vCPU / 4GB | hundreds |
| Growth | 3–6 | 2–4 | 4–8 vCPU | thousands |
| Scale | 10+ | 6+ | HA cluster | tens of thousands |

## Checklist

- [ ] Redis adapter enabled in production
- [ ] `BACKGROUND_QUEUE_MODE=bullmq`
- [ ] Nginx upstream multi-API
- [ ] CDN for gift packs / avatars
- [ ] DB connection pool sized per replica
- [ ] Backups + restore drill
- [ ] Load test wallet + live chat + gift FX

See also: `PRODUCTION.md`
