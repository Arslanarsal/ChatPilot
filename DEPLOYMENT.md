# Deployment & configuration

Everything that has to be set for ChatPilot to run correctly, and where to set it.

The system is three repositories deployed as five containers on one server:

| Repo | Image | Container | Port (host) |
|---|---|---|---|
| `ChatPilot` | `arslanarsal/chatpilot-api` | `chatpilot` | 127.0.0.1:3000 |
| `WB` | `arslanarsal/whatsapp-bot` | `whatsapp-bot` | 127.0.0.1:3002 |
| `ChatPilot-frontend` | `arslanarsal/chatpilot-frontend` | `frontend` | 127.0.0.1:3001 |
| — | `postgres:16-alpine` | `postgres` | internal only |
| — | `redis:7-alpine` | `redis` | internal only |

nginx terminates TLS and proxies `chat-pilot.dev` → 3001, `api.chat-pilot.dev` → 3000,
`wb.chat-pilot.dev` → 3002.

---

## 1. GitHub Actions secrets

Set these in **each** repo: *Settings → Secrets and variables → Actions → New repository secret*.

| Secret | Value | Used for |
|---|---|---|
| `DOCKER_USERNAME` | Docker Hub username | tagging and pushing the image |
| `DOCKER_PASSWORD` | Docker Hub access token | pushing the image |
| `SSH_HOST` | server public IP | the deploy step |
| `SSH_USER` | `azureuser` | the deploy step |
| `SSH_PRIVATE_KEY` | full private key, including the `-----BEGIN`/`-----END` lines | the deploy step |

All five are required in all three repos. If `SSH_*` are wrong the **build** job still
succeeds and only **Deploy to Server** fails — so a green build does not mean the change
reached the server. Check both jobs.

The deploy step runs `docker` without `sudo`, so the SSH user must be in the `docker`
group on the server:

```bash
sudo usermod -aG docker $USER   # then reconnect
```

## 2. Server environment (`~/deployment/.env`)

One shared `.env` is read by all three services. `docker-compose.yml` remaps the `WB_*`
entries onto the names the WB container expects.

| Variable | Notes |
|---|---|
| `DATABASE_URL` | ChatPilot's database — must end in `/chatpilot` |
| `WB_DATABASE_URL` | WB's database — must end in `/wb`, **a different database** (see §4) |
| `POSTGRES_PASSWORD` | must match the password inside both URLs |
| `REDIS_URL` | `redis://redis:6379` — the container name, not localhost |
| `GEMINI_API_KEY` | the AI agent fails to start without it |
| `JWT_SECRET` | also the AES key for stored messages — **changing it makes existing messages unreadable** |
| `JWT_REFRESH_SECRET` | refresh tokens |
| `chatPilot_API_KEY` | service-to-service auth |
| `WB_BASE_URL` | `http://whatsapp-bot:3001` — internal Docker DNS |
| `WB_WEBHOOK_URL` | `http://chatpilot:3000/api/v1/webhook/whats-bailey` |
| `FRONTEND_URL` | must match the real site origin or CORS blocks the dashboard |
| `SUPABASE_STORAGE_URL`, `SUPABASE_SERVICE_KEY` | media uploads (voice, images, PDFs) |
| `SERVER_ID` | `1` — must match `whats_app_session.serverId` |
| `BULL_BOARD_USER`, `BULL_BOARD_PASSWORD` | queue dashboard auth |

## 3. Frontend API URL is baked in at build time

`NEXT_PUBLIC_API_URL` is a **build argument**, not a runtime variable. It is set in
`.github/workflows/deploy.yml`:

```yaml
build-args: |
  NEXT_PUBLIC_API_URL=https://api.chat-pilot.dev/api/v1
```

Changing the API domain means editing that line and rebuilding the image. Editing
`docker-compose.yml` or `.env` will not change it.

## 4. ChatPilot and WB need separate databases

Both run `prisma migrate deploy` on start and **both declare a `whats_app_session`
model**. Pointed at one database their migration histories collide and the containers
crash-loop. Keep `chatpilot` and `wb` as separate databases on the same Postgres
instance. ChatPilot never queries `whats_app_session`, so nothing is lost by splitting.

`wb.whats_app_session.serverId` is `NOT NULL` but is not declared in `schema.prisma`, so
Prisma omits it on insert. Migration `20260830000000_whats_app_session_serverid_default`
gives it a default of `1`; without it every session save fails and **the QR code never
completes pairing** — it just regenerates every 60 seconds.

## 5. Low-memory servers

On a 1 GB host the stack fits only with these limits, which are already in
`docker-compose.yml`. Do not remove them:

- `NODE_OPTIONS=--max-old-space-size=256` on `chatpilot` and `whatsapp-bot`, `192` on `frontend`
- Postgres `shared_buffers=64MB`, `max_connections=50`
- Redis `maxmemory=96mb`
- a 4 GB swapfile on the host

Do not build images on such a host — `npm ci` will exhaust memory. Build in CI and pull.

## 6. Going live

1. Point DNS `@`, `api`, `wb` at the server IP
2. `sudo certbot --nginx -d chat-pilot.dev -d api.chat-pilot.dev -d wb.chat-pilot.dev --redirect`
3. `docker compose up -d`
4. Sign up on the dashboard, then **scan the WhatsApp QR** — until a session exists the
   bot cannot send or receive anything, even though every health check passes

## 7. Checking a deployment

```bash
cd ~/deployment
docker compose ps
docker compose logs -f chatpilot
docker compose logs -f whatsapp-bot        # watch this while scanning the QR
docker exec -it postgres psql -U chatpilot -d chatpilot
curl -s localhost:3002/api/v1/whatsapp/sessions
```

A healthy but unlinked system returns `{"sessions":[]}` and shows
`whatsapp_connection_status = f` on the company row. That is the normal state before the
QR is scanned, not a fault.
