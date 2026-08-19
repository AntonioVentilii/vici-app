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

| Domain                        | Where the branch lives                                                                                                                                                                  | Notes                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Analytics                     | `analytics.services.ts` (flush call site)                                                                                                                                               | The reference for the per-service swap below.                                                           |
| Auth                          | `authn/SignInProviderStack.svelte`, `authn/Authn.svelte`, `Logout.svelte`                                                                                                               | The identity layer, not a per-service swap. See "Auth" below.                                           |
| Profiles + social             | `profile.services.ts`, `user-stats.services.ts`, `relation.services.ts`, `relation-queries.services.ts`, `leaderboard.services.ts`                                                      | Per-service swaps. Plus the app-shell hydration in `Authn.svelte`. See "Profiles and social" below.     |
| Markets + public engine reads | `market.services.ts`, `market-metadata.services.ts`, `market-translation.services.ts`, `resolution.services.ts`, `trade.services.ts`, `standings.services.ts`, `collateral.services.ts` | Public reads only; user-signed engine calls stay on-chain. See "Markets and public engine reads" below. |

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

## Profiles and social

This is the worked example of the per-service swap for a data domain, and
the exemplar for the ones that follow.

### The identity rename

The HTTP API keys a user by an opaque account id (`userId`, a uuid) where
the on-chain stack keys by a principal. The app's domain shapes carry that
identity in a single `owner` string (`UserProfile.owner`,
`Relation.participants`, `ResolvedResult.owner`, `UserStatsDoc.owner`), so
the `client.ts` wrappers carry the `userId` → `owner` rename and re-narrow
the loose wire string unions (`visibility`, `role`) back to the app enums.
The result is byte-identical to the satellite services, so every component
and store stays backend-agnostic. In web2 mode `owner` simply holds the
account id instead of a principal.

### Service-layer branches

Each read/write branches on `isWeb2Backend()` inside its owning
`*.services.ts`, calling a `client.ts` wrapper on the web2 side and leaving
the on-chain call untouched on the default side:

- `profile.services.ts`: `getProfile`, `searchProfiles`,
  `checkNicknameAvailability`, `checkFriendship`, `recordFlowSwipe`,
  `upsertProfile`. The composed writers (`patchProfile`, `persistDailyStreak`,
  `applyOnboardingPicks`, `persistPreferences`, `recordActivity`) ride the
  swap for free: they route through `getProfile` + `upsertProfile`.
- `user-stats.services.ts`: `loadMyUserStats` (the Dash read).
- `leaderboard.services.ts`: `getLeaderboard`, `getMyRival`.
- `relation.services.ts`: `sendFriendRequest` (with a web2 `@handle` / account-id
  resolver), `accept` / `reject` / `cancel`, `unfriend`, `follow`, `unfollow`.
- `relation-queries.services.ts`: friends, followers, following, friend
  requests (sent + received), friend-scoped resolved results.

### App-shell hydration

The auth swap left `userStore` (the store the whole authenticated app reads)
unhydrated in web2 mode. `Authn.svelte` now mirrors the cookie session into
it: an `$effect` watches `web2SessionStore` and, when a user resolves, builds
a minimal `User` (`key` / `owner` = account id), reads the profile via
`loadWeb2ProfileShell` (the default shell with `profileExisted: false` for a
brand-new account, so the onboarding drain runs identically), and sets
`userStore`. Sign-out and the signed-out steady state clear it, so the shell
never hangs on `authBusy`. This lives in `Authn.svelte` because it is the
sanctioned identity-layer exception; no other component gains a branch.

### Still on-chain in this domain

- `calculateAndSyncStats` (and its `persistMyUserStats` /
  `syncMyMonthlyStats` writes) reads the on-chain clearing history, so it
  stays on the engine backend until the custody / engine bridge lands. In
  web2 mode the login stats sync is simply not run; the Dash reads whatever
  `user_stats` the API holds (empty until that write path swaps).
- Activities + reactions (`activity.services.ts`,
  `activity-reaction.services.ts`) and the private-email doc
  (`getMyEmail` / `saveMyEmail`) are unswapped; the account email in web2
  rides the auth identity, not the profile doc. `client.ts` intentionally
  does not yet ship wrappers for these to avoid unused surface.

## Markets and public engine reads

The fourth swapped domain: market curation (metadata, translations) plus
every PUBLIC engine read the HTTP API bridges (`/api/v1/markets/...`,
`/api/v1/engine/...`). User-signed engine calls (order submit/cancel,
collateral deposit/withdraw, positions, own orders, own trade history)
remain on-chain in BOTH modes until the engine / wallet swap maps engine
identities onto accounts; web2 mode never signs an engine call.

### The wire seam: serialized candid

The engine routes return the canisters' candid responses serialized to
JSON: bigints as decimal strings, principals as text, candid optionals
still `[] | [value]`. [`web2/engine-wire.ts`](../../../src/lib/web2/engine-wire.ts)
holds the explicit per-type mappers that convert each payload back into
the exact `$declarations` candid types (`RegistryDid.Series`,
`ClearingDid.SettlementStatusView`, candles, trade pages, volumes,
collateral assets, leaderboard entries), so utils, stores, and components
consume identical shapes on both transports. Mappers are field-explicit
on purpose: a blanket digits-to-bigint pass cannot tell an id string from
a serialized bigint. The `client.ts` wrappers (`listEngineSeries`,
`getEngineSeries`, `getEngineSettlementStatus`, `getEnginePriceHistory`,
`listEngineSeriesTrades`, `listEngineSeriesVolumes`,
`listEngineSettledSeries`, `listEngineCollateralAssets`,
`listEngineLeaderboard`, plus the markets metadata / translation set)
apply them at the fetch boundary.

### Service-layer branches

- `market.services.ts`: the series catalog (`listSeries`, both the full
  and the unexpired read), per-series `getSeries`, the settlement status
  on the detail fetch, and the traded-volumes batch. The bridge's
  tradeable-now filter stands in for `only_unexpired` (equivalent here:
  no series carries a future start gate). The volumes read drops the
  anonymous short-circuit in web2 mode because the bridge exposes it
  publicly.
- `market-metadata.services.ts` / `market-translation.services.ts`:
  reads and curator-gated upserts; the HTTP API already speaks the app's
  camelCase doc shapes, so these are envelope unwraps.
- `resolution.services.ts`: `getSettledSeriesIds` (bridge read is
  domain-unfiltered, safe because series ids are globally unique) and
  `loadSettlementOutcomes` (same batching, per-series bridge status).
- `trade.services.ts`: price-history candles and the traded-volume tape
  drain. Callback flows deliver the bridge's single response as the final
  `certified: true` pass, since no query/update pair exists on HTTP.
- `standings.services.ts`: the global leaderboard (`getStandings`).
  `getLeagueStandings` stays on-chain: the bridge has no member filter
  and rosters are keyed by engine identities (engine / wallet domain).
- `collateral.services.ts`: the collateral-asset catalog, without the
  signed-identity gate in web2 mode (the bridge read is public).

### Still on-chain in this domain

- Order books (`order.services.ts` / `getOrderBook`): no HTTP surface
  yet; the anonymous on-chain query is publicly readable, so web2 mode
  still prices lists, decks, and detail pages from it.
- The bulk metadata projections in `market-tags.services.ts`
  (`listMarketTagsBySeries`, `listMarketMetadataBySeries`) scan the
  public `MARKET_METADATA` collection via Juno `listDocs`; the HTTP API
  has no public bulk-metadata list yet (its `/markets/tags` bucket index
  is admin-only), so these stay on the satellite until that read exists.
- Market creation / forking (`createMarket`, `forkMarket`) and admin
  settlement (`resolution.services.ts` `settleMarket`) are user-signed
  registry / clearing writes: engine / wallet domain.
- Leaderboard identity caveat: web2 standings entries keep the on-chain
  principal as `owner` (clearing's native key) until the engine identity
  mapping lands.

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
