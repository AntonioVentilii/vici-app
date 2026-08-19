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

## Swapped domains

| Domain    | Where the branch lives                                                    | Notes                                                         |
| --------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Analytics | `analytics.services.ts` (flush call site)                                 | The reference for the per-service swap below.                 |
| Auth      | `authn/SignInProviderStack.svelte`, `authn/Authn.svelte`, `Logout.svelte` | The identity layer, not a per-service swap. See "Auth" below. |

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

## Auth

Auth is not a per-service swap: the whole identity layer switches, because
half-swapped auth would leave reads and writes authenticated against
different identities. In web2 mode there is no local identity to read. The
browser holds an HttpOnly session cookie set by the API, and "signed in"
derives from `GET /api/v1/me` succeeding, not from an on-chain delegation.

- **Session state — `web2/session.ts`.** A small store (`web2SessionStore`)
  is the cookie-session counterpart to the on-chain identity flow.
  `loadWeb2Session()` probes `/me` (a 401 is the signed-out steady state,
  not an error), `adoptWeb2Session(user)` seeds it from a login response,
  and `clearWeb2Session()` revokes server-side then drops local state.
- **Session bootstrap — `Authn.svelte`.** `onMount` branches: web2 runs
  `loadWeb2Session()` in place of Juno's `onAuthStateChange`. The on-chain
  path is left byte-for-byte as it was.
- **Sign-in — `SignInProviderStack.svelte`.** In web2 mode it renders
  `SignInProviderStackWeb2.svelte`: email one-time code (request then verify
  via `requestOtp` / `verifyOtp`), Google as a full-page redirect to
  `googleSignInUrl()` (the API drives the OAuth dance and lands back on the
  app root, where `Authn` picks up the session), and Apple + Passkey shown
  disabled ("coming soon") since neither is wired on this transport yet. The
  on-chain provider stack is untouched behind the same branch.
- **Sign-out — `Logout.svelte`.** web2 calls `clearWeb2Session()`; on-chain
  calls Juno `signOut()`.

Engine calls still read the on-chain identity (`getIdentity()` /
`getIdentityOnce()`); those stay on-chain until the custody/engine bridge
lands, so the auth branch never reaches for a Juno identity in web2 mode.

`client.ts` ships the auth surface: `getProviders()`, `getMe()`,
`requestOtp()`, `verifyOtp()`, `googleSignInUrl()`, `logout()`.

## Guardrails

- Never read `VITE_BACKEND` directly; always go through `backend-mode.ts`
  so the default stays in one place.
- No `isWeb2Backend()` branches in components or stores; the seam lives in
  services. The one sanctioned exception is the identity layer, whose swap
  is inherently UI-driven (one-time-code entry, redirect handoff): the auth
  branches live in `Authn.svelte`, `SignInProviderStack.svelte`, and
  `Logout.svelte`, with the session store in `web2/session.ts`.
- Analytics event payloads stay behavioural and pseudonymous on both
  transports; the server stamps time and identity in both modes.
- Constants mirrored between `src/` and `backend/` (locales, market
  taxonomy, analytics taxonomy, VXP tunables, vendored declarations,
  custody asset seeds) are pinned by the drift suite in
  `backend/tests/shared-drift/` - see "Mirrored constants" in
  [`backend/README.md`](../../../backend/README.md). Editing either side
  of a pair triggers the backend checks; keep both sides in the same PR.
