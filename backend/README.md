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

| Var                       | Required (prod) | Default (dev)                                | Purpose                                                                                     |
| ------------------------- | --------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | yes             | `postgres://vici:vici@localhost:5432/vici`   | Postgres connection string                                                                  |
| `SESSION_SECRET`          | yes             | dev placeholder                              | HMAC pepper for session token hashes                                                        |
| `PORT`                    | no              | `8787`                                       | API listen port                                                                             |
| `PUBLIC_APP_URL`          | no              | `http://localhost:5173`                      | SPA origin: credentialed CORS allowlist (+ www/apex twin)                                   |
| `API_BASE_URL`            | no              | `http://localhost:<port>`                    | This server's public origin (absolute callback URLs)                                        |
| `LOG_LEVEL`               | no              | `info`                                       | `debug` / `info` / `warn` / `error`                                                         |
| `WORKER_POLL_INTERVAL_MS` | no              | `60000`                                      | Worker loop poll interval                                                                   |
| `SESSION_TTL_HOURS`       | no              | `720`                                        | Session lifetime (30 days)                                                                  |
| `COOKIE_DOMAIN`           | no              | empty (host-only)                            | Cookie Domain attribute for prod cross-subdomain sessions                                   |
| `GOOGLE_CLIENT_ID`        | no              | empty (google disabled)                      | Google OAuth client id                                                                      |
| `GOOGLE_CLIENT_SECRET`    | no              | empty (google disabled)                      | Google OAuth client secret                                                                  |
| `GOOGLE_REDIRECT_URI`     | no              | `<API_BASE_URL>/api/v1/auth/google/callback` | Override for the Google callback URL                                                        |
| `APPLE_CLIENT_ID`         | no              | empty (apple disabled)                       | Sign in with Apple services id                                                              |
| `APPLE_TEAM_ID`           | no              | empty (apple disabled)                       | Apple developer team id                                                                     |
| `APPLE_KEY_ID`            | no              | empty (apple disabled)                       | Key id of the .p8 signing key                                                               |
| `APPLE_PRIVATE_KEY`       | no              | empty (apple disabled)                       | .p8 PKCS#8 PEM (literal or \n-escaped newlines)                                             |
| `APPLE_REDIRECT_URI`      | no              | `<API_BASE_URL>/api/v1/auth/apple/callback`  | Override for the Apple callback URL                                                         |
| `RESEND_API_KEY`          | no              | empty (email logs to console)                | Resend API key for transactional email                                                      |
| `EMAIL_FROM`              | no              | `VICI <no-reply@vici.app>`                   | From header for transactional email                                                         |
| `ROOT_SECRET`             | yes             | dev placeholder                              | HKDF root for per-user per-chain custody keys (rotating it rotates every custodial address) |
| `TREASURY_PEM`            | no              | empty (svc-derived key)                      | PEM override for the treasury IC identity                                                   |
| `ADMIN_PEM`               | no              | empty (svc-derived key)                      | PEM override for the admin IC identity                                                      |
| `CUSTODY_ENABLED_ASSETS`  | no              | empty (all ic assets)                        | Comma list of `symbol` or `chain:symbol` to enable                                          |
| `IC_HOST`                 | no              | `https://icp-api.io`                         | IC API host (adapter enabled by default)                                                    |
| `CLEARING_CANISTER_ID`    | no              | mainnet id                                   | Clearing canister id                                                                        |
| `REGISTRY_CANISTER_ID`    | no              | mainnet id                                   | Registry canister id                                                                        |
| `EVM_RPC_URL`             | no              | empty (evm disabled)                         | EVM JSON-RPC endpoint                                                                       |
| `EVM_CHAIN_ID`            | no              | `1`                                          | EVM chain id for EIP-1559 signing                                                           |
| `EVM_CONFIRMATIONS`       | no              | `12`                                         | Deposit confirmation depth                                                                  |
| `SOL_RPC_URL`             | no              | empty (sol disabled)                         | Solana JSON-RPC endpoint                                                                    |
| `SOL_COMMITMENT`          | no              | `finalized`                                  | Solana commitment level                                                                     |
| `BTC_ESPLORA_URL`         | no              | empty (btc disabled)                         | Esplora-compatible API base (e.g. mempool.space/api)                                        |
| `BTC_NETWORK`             | no              | `mainnet`                                    | `mainnet` / `testnet` / `regtest`                                                           |
| `BTC_CONFIRMATIONS`       | no              | `2`                                          | Deposit confirmation depth                                                                  |

## Auth

Sessions are opaque 256-bit tokens in the HttpOnly `vici_session` cookie (SameSite=Lax, Secure in prod, Domain from `COOKIE_DOMAIN`); the database stores only `HMAC-SHA256(token, SESSION_SECRET)`. Login always rotates the token; logout revokes it server-side.

Endpoints under `/api/v1`:

- `GET /auth/providers`: which sign-in methods are live. A provider whose env is not configured reports `coming_soon` (the FE renders a disabled button) and its endpoints answer `503 { "error": "provider_unavailable" }`.
- `POST /auth/otp/request` + `POST /auth/otp/verify`: email one-time codes (10 min TTL, single-use, 5-attempt lockout, hashed at rest, identical responses for known and unknown addresses).
- `GET /auth/google` + `GET /auth/google/callback`: Google OAuth code flow with an HMAC-signed state cookie.
- `GET /auth/apple` + `POST /auth/apple/callback`: Sign in with Apple (ES256 client secret from the .p8 key, `form_post` callback, SameSite=None state cookie).
- `POST /auth/logout`, `GET /me`.

First verified login auto-links legacy on-chain identities: when the account has no `legacy_principals` row yet and the exported `legacy_auth_identities` table contains a row whose `openid_email` (first) or `profile_email` (fallback) matches the verified address, the principal links with the corresponding `matched_via`. The export tooling that fills `legacy_auth_identities` lands in a later phase; until then the table is empty and logins simply skip the match.

## Custody

Every user gets deterministic per-chain custodial keys, HKDF-SHA256 derived from `ROOT_SECRET` with the info string `user:<userId>:<chain>` (ed25519 for `ic`/`sol`, secp256k1 for `evm`/`btc`); the database stores addresses only, never key material. Treasury/admin service identities derive under a disjoint `svc:` prefix, or come from `TREASURY_PEM` / `ADMIN_PEM`.

Balances live on a double-entry ledger (`ledger_entries` + the `custody_balances` view): every event posts legs summing to zero per asset, keyed for idempotent replay. Withdrawals hold the amount at request time and refund on failure/rejection through the state machine `requested -> processing -> submitted -> confirmed` (with `failed` / `rejected` exits); self-custody exits are the same flow with a user-controlled destination. Deposits are credited by per-chain watchers running from the worker loop; only chains whose adapter is enabled are polled.

Chain adapters live under `src/chains/` behind one interface (`chains/types.ts`). The `ic` adapter is enabled by default (mainnet host); `evm`, `sol` and `btc` enable through their env vars and answer `503 { "error": "chain_unavailable" }` until configured. Asset seeding is in migration `0003_custody.sql`; the `CUSTODY_ENABLED_ASSETS` allowlist is re-applied at boot.

## Engine bridge

`src/engine/` wraps the on-chain clearing + registry canisters with the same method surface the app consumes, over candid bindings vendored under `src/declarations/` (verbatim copies of the app's generated bindings; refresh by re-copying, never hand-edit). Public market reads run anonymously behind a 15s in-memory TTL cache; account-scoped calls (orders, collateral, positions) sign with the calling user's derived custodial IC identity; settlement-grade calls sign with the admin identity. Routes: `routes/engine.ts` (public reads + session-gated trading) and `routes/wallet.ts` (balances, deposit addresses, withdrawals).

## Markets and analytics

`src/markets/` carries the market curation surface: per-series editorial metadata (`market_metadata`), per-locale translation overlays (`market_translations`, validated against the registered locale ids), and the tag reverse index (`market_tag_index`) derived from the closed 3-layer taxonomy (micros plus their macros; free tags are never indexed). Writes go through the curator gate: an admin may edit any series, the series creator their own, where the creator principal from the registry is matched against the caller's derived custodial identity or a linked legacy principal. The index is maintained in the same transaction as each metadata write and can be rebuilt from scratch via the admin corrective (`POST /api/v1/markets/tags/rebuild`).

`src/analytics/` is the behavioural event pipeline: `POST /api/v1/events` ingests client batches (public: anonymous visitors track too; a session adds the pseudonymous user link), capped at 100 events per call with server-authoritative timestamps, and bumps the per-day rollup counters in the same transaction. `captureServerEvents` is the internal bridge other domains call for server-originated events (VXP payouts, settlements). Admin endpoints mirror the warehouse contract: daily summary, keyset event export with an idempotent drain delete, the registered-account count, and the profile-created export.

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
    worker.ts       # background loop (deposit watcher ticks; domain jobs land per phase)
    env.ts          # validated environment
    analytics/      # behavioural event ingest, rollups, warehouse export + drain
    auth/           # sessions, guards, identity resolution, OTP, Google, Apple
    chains/         # chain adapters (ic/evm/sol/btc) + registry + deposit watchers
    custody/        # assets, custody accounts, double-entry ledger, withdrawals
    markets/        # market metadata, translations, tag index, curator gate
    declarations/   # vendored candid bindings for clearing + registry (generated, never hand-edited)
    engine/         # actor provider, TTL cache, typed clearing/registry wrappers
    routes/         # /api/v1 route modules (auth, wallet, engine, markets, events, ...)
    lib/            # logger, crypto, keys (HKDF derivation), ic-agent, cookies, email, rate limiting
    db/
      client.ts     # pg pool, query/tx helpers, isDbUnavailable
      migrate.ts    # forward-only migration runner (_migrations tracking)
      migrations/   # NNNN_name.sql, lexical order, never edited after merge
  tests/            # bun test suites (real Postgres, no mocks for DB paths)
```
