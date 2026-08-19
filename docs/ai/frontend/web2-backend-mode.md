# Web2 backend mode (the backend seam)

The app can talk to two backends: the current on-chain stack (satellite +
canisters, the default) and an HTTP API served from
[`backend/`](../../../backend/README.md) under `/api/v1/...`. The switch
is a build-time flag; a build without the flag behaves exactly as today.

This page is the contract for how a domain gets a dual-mode path. Read it
before adding any `isWeb2Backend()` branch.

## The seam

Two files under `src/lib/web2/`:

- [`backend-mode.ts`](../../../src/lib/web2/backend-mode.ts):
  `isWeb2Backend()` / `backendMode()` read `VITE_BACKEND`, and
  `web2ApiBaseUrl()` reads `VITE_WEB2_API_URL`. Defaults: `web3` mode,
  empty base URL (same-origin relative paths).
- [`client.ts`](../../../src/lib/web2/client.ts): thin typed fetch client.
  Every request sends `credentials: 'include'` (sessions are HttpOnly
  cookies; the client holds no auth state) and non-2xx responses throw
  `Web2ApiError` carrying `status` plus the stable `code` from the API's
  `{ error: string }` envelope. One typed wrapper per endpoint, shape
  mapping only.

## Env vars

| Var                 | Values           | Default | Effect                                                                       |
| ------------------- | ---------------- | ------- | ---------------------------------------------------------------------------- |
| `VITE_BACKEND`      | `web3` \| `web2` | `web3`  | Selects the backend for domains that have a dual-mode path. Build-time only. |
| `VITE_WEB2_API_URL` | origin URL       | empty   | Base of the HTTP API. Empty = same-origin relative (reverse-proxy shape).    |

## The swap pattern (exemplar: analytics flush)

[`analytics.services.ts`](../../../src/lib/services/analytics.services.ts)
is the reference. The rules it demonstrates:

1. **Branch at the transport call site, inside the owning `*.services.ts`
   module.** Everything else (buffering, debounce, validation, UX, error
   swallowing) stays shared; only the line that sends bytes switches.
2. **Static imports only.** Import `isWeb2Backend` and the client wrapper
   at the top of the module. Never `await import()` inside the branch.
3. **Add a typed wrapper in `client.ts` per endpoint**, typed to the wire
   contract of the HTTP API route. If the wire shape differs from the
   satellite shape, map it inside the wrapper, not in the service.
4. **Default path is byte-for-byte today's behavior.** The `web3` branch
   must remain the exact pre-seam code; a diff with `VITE_BACKEND` unset
   must change nothing observable.

```ts
if (isWeb2Backend()) {
	await postEvents({ events });
} else {
	await functions.trackEvents({ events });
}
```

## Rolling out the remaining domains

Data domains (profiles, social, markets, leaderboards, leagues, wallet,
VXP, worlds, school, account, admin) swap one service module at a time
using the pattern above: the satellite / canister call in the service is
paired with a `client.ts` wrapper hitting the matching `/api/v1/<domain>`
route, behind `isWeb2Backend()`.

Auth is the exception: it does not go dual-mode per service. The identity
layer swaps wholesale at cutover (cookie sessions replace the on-chain
identity flow), because half-swapped auth would leave reads and writes
authenticated against different identities. Until cutover, web2 mode only
covers paths that work with an anonymous or cookie-linked caller (the
analytics ingest is deliberately such a path). `client.ts` already ships
the auth basics for that moment: `getProviders()`, `getMe()`, `logout()`.

## Guardrails

- Never read `VITE_BACKEND` directly; always go through `backend-mode.ts`
  so the default stays in one place.
- No `isWeb2Backend()` branches in components or stores; the seam lives in
  services (and, for auth at cutover, the identity layer).
- Analytics event payloads stay behavioural and pseudonymous on both
  transports; the server stamps time and identity in both modes.
