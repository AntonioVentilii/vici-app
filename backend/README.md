# VICI backend

Bun + Elysia + Postgres API for the VICI app. Purely additive for now: the production app keeps running on the current stack while the domains are ported here phase by phase.

## Local development

Requirements: [Bun](https://bun.sh) >= 1.3 and Docker.

```bash
cd backend
docker compose up -d      # local Postgres 16 (db/user/password: vici)
bun install
bun run migrate           # apply src/db/migrations/*.sql
bun dev                   # API on http://localhost:8787 (watch mode)
bun run worker            # background worker loop (optional locally)
```

Checks:

```bash
bun run typecheck         # tsc --noEmit
bun test                  # unit + DB-backed tests (skip DB suites if Postgres is down)
```

Tests connect to `TEST_DATABASE_URL` (default: the docker-compose Postgres). CI sets `REQUIRE_DB_TESTS=1` so a missing database fails the build instead of silently skipping the DB-backed suites.

## Environment

Validated fail-fast in `src/env.ts`. In production the required vars abort boot when missing; in dev everything has a local default. Optional integrations added by later phases degrade instead of crashing when unconfigured (email logs to console, storage falls back to local disk in dev).

| Var                       | Required (prod) | Default (dev)                              | Purpose                                                   |
| ------------------------- | --------------- | ------------------------------------------ | --------------------------------------------------------- |
| `DATABASE_URL`            | yes             | `postgres://vici:vici@localhost:5432/vici` | Postgres connection string                                |
| `SESSION_SECRET`          | yes             | dev placeholder                            | HMAC pepper for session token hashes                      |
| `PORT`                    | no              | `8787`                                     | API listen port                                           |
| `PUBLIC_APP_URL`          | no              | `http://localhost:5173`                    | SPA origin: credentialed CORS allowlist (+ www/apex twin) |
| `API_BASE_URL`            | no              | `http://localhost:<port>`                  | This server's public origin (absolute callback URLs)      |
| `LOG_LEVEL`               | no              | `info`                                     | `debug` / `info` / `warn` / `error`                       |
| `WORKER_POLL_INTERVAL_MS` | no              | `60000`                                    | Worker loop poll interval                                 |

## Deploy (Fly.io)

Two Fly apps, both in `ams`:

- `vici-app-backend` (`backend/fly.toml`): the API plus a `worker` process. DB migrations run atomically as the `release_command` before traffic shifts, so a failed migration aborts the deploy.
- `vici-app-web` (`fly.web.toml` at the repo root): the static SPA behind nginx (`Dockerfile.web`, `nginx.web.conf`) with SPA fallback and immutable asset caching.

Neither app exists yet. First-time setup:

```bash
cd backend && fly launch --no-deploy            # creates vici-app-backend
fly secrets set DATABASE_URL=... SESSION_SECRET=...
cd .. && fly launch --no-deploy --config fly.web.toml   # creates vici-app-web
```

Deploys go through `.github/workflows/web2-deploy.yml` (manual `workflow_dispatch` only). It needs the repo secrets `FLY_API_TOKEN_WEB2_BACKEND` and `FLY_API_TOKEN_WEB2_WEB`, one `fly tokens create deploy` token per app. Manual fallback: `flyctl deploy --remote-only` from `backend/`, and `flyctl deploy --config fly.web.toml --remote-only` from the repo root.

`GET /health` answers 200 with `{ ok: true, db: 'connected' }` when the bounded (2.5s) DB probe succeeds, 503 otherwise; three consecutive failures exit the process for a supervised restart with a fresh pool.

## Layout

```
backend/
  src/
    index.ts        # Elysia app: security headers, CORS, error mapping, /health
    worker.ts       # background loop (no-op until domain jobs land)
    env.ts          # validated environment
    lib/logger.ts   # console wrapper with level prefixes
    db/
      client.ts     # pg pool, query/tx helpers, isDbUnavailable
      migrate.ts    # forward-only migration runner (_migrations tracking)
      migrations/   # NNNN_name.sql, lexical order, never edited after merge
  tests/            # bun test suites (real Postgres, no mocks for DB paths)
```
