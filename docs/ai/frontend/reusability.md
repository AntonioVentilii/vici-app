# Reusability — Catalog & Rules

> **Before you create, search.** This page is the answer to "is there
> already something for that?". Keep it up to date as part of the
> [meta-update rule](../governance.md#meta-update-rule): every PR that adds
> a reusable building block adds a row here.

## The reuse rule

1. **Search first.** Use `Grep` / `Glob` (or your tool's equivalent) for
   the nearest concept before inventing one.
2. **Reuse if it fits.** Even at 80% — extend it if needed, with props.
3. **Extract if it doesn't.** If two places now do similar things, extract
   to one of the catalog locations below and update both call sites in
   the same PR (still atomic — one logical change: "consolidate X").
4. **Add a row here.** Don't make the next agent re-discover it.

## Where reusable things live

| Layer                       | Path                                    | What goes there                                                                                                                                                                    |
| --------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **UI primitives**           | `$lib/components/ui/`                   | App-local primitives (Button, Card, Modal, Table, Tabs, Switch, …).                                                                                                                |
| **Feature components**      | `$lib/components/<feature>/`            | UI specific to a feature (`market/`, `wallet/`, `social/`, `admin/`, `portfolio/`, `profile/`, `leaderboard/`, `authn/`, `authz/`, `challenge/`, `loaders/`, `layout/`, `pages/`). |
| **Bespoke icons**           | `$lib/components/icons/`                | Project icons not covered by `lucide-svelte`.                                                                                                                                      |
| **Cross-cutting utils**     | `$lib/utils/<concern>.utils.ts`         | Pure helpers usable across features.                                                                                                                                               |
| **Cross-cutting constants** | `$lib/constants/<concern>.constants.ts` | App-wide constants & lookup tables.                                                                                                                                                |
| **Cross-cutting services**  | `$lib/services/<thing>.services.ts`     | Side-effectful operations shared across features.                                                                                                                                  |
| **Stores / derived**        | `$lib/stores/`, `$lib/derived/`         | Reactive state shared across views.                                                                                                                                                |
| **Schemas**                 | `$lib/schema/<area>.schema.ts`          | Zod schemas for typed boundaries.                                                                                                                                                  |
| **API wrappers**            | `$lib/api/<canister>.api.ts`            | Hand-written wrappers around generated declarations.                                                                                                                               |
| **Actor factories**         | `$lib/canisters/<canister>.canister.ts` | IC actor factories.                                                                                                                                                                |

## Catalog (current — keep this honest)

> Edit this section in any PR that adds, renames, or removes an entry
> matching one of these buckets. Don't list every component — list things
> agents are most likely to re-create by accident.

### UI primitives — `$lib/components/ui/`

| Component         | Use it for                                                  |
| ----------------- | ----------------------------------------------------------- |
| `Backdrop`        | Modal / dialog backdrop.                                    |
| `Badge`           | Small inline status / count chip.                           |
| `Banner`          | Page-level info / warning banners.                          |
| `BaseButton`      | Unstyled button base; prefer `Button` for app-styled CTAs.  |
| `Button`          | Default app button. Variants via props.                     |
| `Card`            | Glass-card surface. Don't roll your own.                    |
| `CopyableAddress` | Clipboard-copy address surface.                             |
| `Delete`          | Inline delete control.                                      |
| `Dialog`          | Modal dialog primitive.                                     |
| `EmptyState`      | List/empty placeholder.                                     |
| `InfiniteScroll`  | Pagination by scroll.                                       |
| `LoadingSpinner`  | Spinner. For full-region loading prefer a `loaders/` block. |
| `Modal`           | Modal shell with close handling.                            |
| `Notifications`   | Toast/notification surface.                                 |
| `PopOver`         | Anchored popover.                                           |
| `PrincipalText`   | Render an IC principal in the standard format.              |
| `SectionHeader`   | Section header w/ tokens.                                   |
| `StatCard`        | Stat tile.                                                  |
| `Switch`          | On/off toggle.                                              |
| `Table`           | Themed data table.                                          |
| `Tabs`            | Tab strip.                                                  |
| `YouBadge`        | "You" callout next to a profile.                            |

### Bespoke icons — `$lib/components/icons/`

Use `lucide-svelte` first; these are the project's own SVGs.

| Component         | Use it for                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `IconGoogle`      | Google sign-in button.                                                                                 |
| `IconIC`          | Internet Identity sign-in button.                                                                      |
| `IconPasskey`     | Passkey / WebAuthn surfaces.                                                                           |
| `IconRobot`       | Bot / automation surfaces.                                                                             |
| `IconSignalYes`   | YES prediction signal — arrow-up + tail. Use `text-yes` to colour it.                                  |
| `IconSignalNo`    | NO prediction signal — arrow-down + tail. Use `text-no` to colour it.                                  |
| `IconSignalHold`  | HOLD prediction signal — pause-style glyph. Use `text-hold` to colour it.                              |
| `IconStreakFlame` | Small streak-counter flame badge. Distinct from `FlameChar.svelte` (the animated companion character). |
| `IconLaurel`      | Two laurel branches (200×120, non-square). For rank / achievement surfaces. Pass `size` as the height. |
| `IconXpChevron`   | XP indicator — stacked chevrons.                                                                       |

Static brand assets that aren't components live in `static/branding/`:
`vici-wordmark.svg`, `vici-monogram.svg`, `vici-app-icon.svg`, `grain.svg`
(noise overlay), `laurel-watermark.svg` (background watermark).

### Feature folders worth knowing

| Folder                         | Purpose                                                                   |
| ------------------------------ | ------------------------------------------------------------------------- |
| `$lib/components/market/`      | Market cards, filters, detail panes, order book, resolution / settlement. |
| `$lib/components/wallet/`      | Collateral, send/receive, token displays.                                 |
| `$lib/components/portfolio/`   | Positions, P&L, history.                                                  |
| `$lib/components/social/`      | Comments, discussions, relations (friends / follow).                      |
| `$lib/components/profile/`     | Profile read + edit surfaces.                                             |
| `$lib/components/leaderboard/` | Leaderboard widgets.                                                      |
| `$lib/components/admin/`       | Admin console surfaces.                                                   |
| `$lib/components/authn/`       | Auth flows (II + Google OpenID).                                          |
| `$lib/components/authz/`       | Role-gated rendering.                                                     |
| `$lib/components/challenge/`   | Challenge / passkey UI.                                                   |
| `$lib/components/layout/`      | Header, navigation chrome.                                                |
| `$lib/components/pages/`       | Page-level shells composed inside the single SvelteKit route.             |
| `$lib/components/loaders/`     | Loaders / skeletons / suspense boundaries.                                |
| `$lib/components/icons/`       | Bespoke project icons.                                                    |

### Services worth knowing — `$lib/services/`

| Service                                                     | Purpose                                                                      |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `identity.services`                                         | Principal source of truth (`getIdentityOrAnonymous`, `safeGetIdentityOnce`). |
| `authn.services`                                            | Sign-in / sign-out orchestration.                                            |
| `market.services`                                           | Market creation, listing, fork, settlement (talks to the registry + engine). |
| `oracle.services`                                           | Oracle bootstrap and settlement helpers.                                     |
| `collateral.services`                                       | Collateral deposit / withdraw / claim flows.                                 |
| `order.services`                                            | Order placement / cancellation against the clearing canister.                |
| `position.services`                                         | Position fetching and P&L wiring.                                            |
| `trade.services`                                            | Trade execution wrapper.                                                     |
| `flow.services`                                             | Multi-step flow orchestration (Rush Mode, etc.).                             |
| `wallet.service`                                            | Token balances + send/receive.                                               |
| `profile.services`                                          | Read / write user profile via Juno datastore.                                |
| `relation.services`                                         | Friends / follow / friend requests.                                          |
| `roles.services`                                            | Read role docs from Juno (mirrored to the engine by the satellite hook).     |
| `discussion.services` / `chat.services` / `social.services` | Social graph features.                                                       |
| `category.services`                                         | Market categories.                                                           |
| `leaderboard.services`                                      | Leaderboard read paths.                                                      |
| `activity.services`                                         | User activity feed.                                                          |
| `query-update.services`                                     | Helper for IC query → update certified upgrade flows.                        |
| `balance-domain.services`                                   | Helpers for reading / switching balance domains.                             |
| `resolution.services`                                       | Market resolution flow.                                                      |
| `send.services`                                             | Token send.                                                                  |
| `group.services`                                            | Group / cohort helpers.                                                      |

### Stores & derived worth knowing

| Module                                      | Where                              | Purpose                                            |
| ------------------------------------------- | ---------------------------------- | -------------------------------------------------- |
| `user.store`                                | `$lib/stores/`                     | Authenticated user state.                          |
| `markets.store`, `markets.derived`          | `$lib/stores/`, `$lib/derived/`    | Market list + derived filters.                     |
| `balances.store`                            | `$lib/stores/`                     | Token balances.                                    |
| `collaterals.store`                         | `$lib/stores/`                     | Collateral positions.                              |
| `orders.store`, `orders.derived`            | `$lib/stores/`, `$lib/derived/`    | Order book + derived view.                         |
| `order-book.store`                          | `$lib/stores/`                     | Live order book.                                   |
| `trade.store`                               | `$lib/stores/`                     | Active-trade UI state.                             |
| `notification.store`                        | `$lib/stores/`                     | Toasts.                                            |
| `theme.store`                               | `$lib/stores/`                     | Light / dark theme.                                |
| `storage.store`                             | `$lib/stores/`                     | LocalStorage-backed state.                         |
| `balance-domain.store`                      | `$lib/stores/`                     | Active balance domain.                             |
| `certified.store`, `certified-setter.store` | `$lib/stores/`                     | Certified-state plumbing for IC queries → updates. |
| `nav.derived`, `nav.constants`              | `$lib/derived/`, `$lib/constants/` | Navigation state + config.                         |
| `tokens.derived`                            | `$lib/derived/`                    | Active / supported tokens.                         |
| `playground.derived`                        | `$lib/derived/`                    | Playground (test) mode helpers.                    |
| `page-market.derived`                       | `$lib/derived/`                    | Per-page market selector.                          |
| `user.derived`                              | `$lib/derived/`                    | Derived user predicates.                           |

### Constants worth knowing — `$lib/constants/`

| File                                                                        | Notes                                                                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `app.constants`                                                             | App-wide identifiers, including `ZERO` (use this, not `0n`).                                      |
| `routes.constants`                                                          | Route paths — never hard-code routes.                                                             |
| `nav.constants`                                                             | Navigation config (entries, icons, paths).                                                        |
| `canisters.constants`                                                       | Canister IDs per network.                                                                         |
| `controllers.constants`                                                     | Satellite controllers / human admins.                                                             |
| `icdc.constants`                                                            | `VICI_ENGINE_ID` (= `eng_0`) and oracle IDs.                                                      |
| `tokens/` directory                                                         | Per-token configuration (decimals, symbols, ledger IDs).                                          |
| `events.constants`                                                          | Custom-event names.                                                                               |
| `authz.constants`                                                           | Permissions registry.                                                                             |
| `collections.constants`                                                     | Juno datastore collection names — keep in sync with `juno.collections.json` and `juno.config.ts`. |
| `portfolio.constants`                                                       | Portfolio-page knobs.                                                                             |
| `playground.constants` / `vxp-onboarding.constants` / `vxp-trade.constants` | Playground / VXP flow config.                                                                     |

### Common utils — `$lib/utils/`

| Util                                                  | Purpose                                     |
| ----------------------------------------------------- | ------------------------------------------- |
| `format.utils`                                        | Number / time / address formatting.         |
| `parse.utils`                                         | Inverse parsers.                            |
| `market.utils`                                        | Pure market helpers (status, payoff math).  |
| `market-filters.utils`                                | Filter predicate composition.               |
| `market-groups.utils`                                 | Group derivation.                           |
| `market-token.utils`                                  | Token-aware market helpers.                 |
| `payoff.utils`                                        | Payoff math.                                |
| `position.utils`                                      | Position math.                              |
| `portfolio.utils`                                     | Portfolio aggregation.                      |
| `trade.utils`                                         | Trade helpers.                              |
| `transactions.utils`                                  | Transaction formatting.                     |
| `tokens.utils`                                        | Token lookup / unit conversion.             |
| `token-ui.utils`                                      | UI-side token helpers (icon resolution, …). |
| `asset.utils` / `asset-ref.utils`                     | Asset reference helpers.                    |
| `collateral-ui.utils`                                 | Collateral surfacing helpers.               |
| `authz.utils`                                         | Authorization predicate helpers.            |
| `avatar.utils`                                        | Avatar generation.                          |
| `relation.utils`                                      | Friend / follow helpers.                    |
| `events.utils`                                        | Custom-event helpers.                       |
| `clipboard.utils`                                     | Clipboard helpers.                          |
| `download.utils`                                      | Browser download helpers.                   |
| `storage.utils`                                       | LocalStorage / sessionStorage helpers.      |
| `refresh.utils`                                       | Polling / refresh primitives.               |
| `search.utils`                                        | Search predicates.                          |
| `playground-display.utils` / `playground-token.utils` | Playground helpers.                         |
| `balance-domain.utils`                                | Balance-domain helpers.                     |
| `activity.utils`                                      | Activity-feed helpers.                      |

### Schemas — `$lib/schema/`

| Schema            | Purpose                                     |
| ----------------- | ------------------------------------------- |
| `market.schema`   | Market shape across the satellite boundary. |
| `profile.schema`  | Profile shape (also used by the satellite). |
| `relation.schema` | Friend / follow relation shape.             |
| `token.schema`    | Token catalog shape.                        |

When in doubt, look at the satellite's `src/satellite/index.ts` to see
which schemas are reused there — those are the ones whose shape is _shared
across the trust boundary_ and must stay in sync.

## When to extract a new shared block

Extract when **all** are true:

- The same shape (markup or function signature) exists in ≥ 2 places.
- The variation is small enough to express as props.
- The new abstraction has a name a non-author would recognise.

Don't extract speculatively for a single caller. The added indirection
costs more than the duplication.

## When to introduce a new top-level concept

Almost never. The taxonomy is closed. If you genuinely think a new bucket
is needed (e.g. a new feature folder under `$lib/components/`), surface it
in the PR description and ask the human owner before doing it.
