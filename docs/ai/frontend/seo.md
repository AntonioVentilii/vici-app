# SEO / crawler surface

> Higher up the chain: [`README.md`](./README.md) → [`docs/ai/`](../README.md).

The app is a static SPA (`adapter-static`, `ssr = false`, `index.html`
fallback), so at runtime every URL serves the same shell. The crawler-facing
layer is generated **at deploy time** instead:

- [`src/app.html`](../../../src/app.html) carries the brand-generic head
  (title, description, canonical, OG/Twitter tags) every page falls back to.
- [`scripts/build/generate-seo-assets.ts`](../../../scripts/build/generate-seo-assets.ts)
  runs as the second `predeploy` step in
  [`juno.config.ts`](../../../juno.config.ts) and emits into `build/`:
  - `sitemap.xml` — public statics + one URL per visible market
    (referenced from [`static/robots.txt`](../../../static/robots.txt));
  - ONE per-market copy of the built shell at `m/{slug~id8}/index.html`
    (the keyword-carrying **canonical**, the same param the share sheet
    hands out) with that market's title/description swapped into the head
    tags and `window.__viciSeriesId` embedded for the `/m/[id]` route.
    The plain-id routes (`/markets/{id}`, `/m/{id}`) deliberately get no
    copies — see the file-count constraint below.

## Slugged share links

`$lib/utils/market-slug.utils` is the single source of the `/m/{param}`
shape: `slugifyMarketTitle` (EN registry title → `will-brazil-beat-norway`)
and `marketShareParam` (`slug~id8`). The 8-hex id suffix makes the param
unique by construction — registry titles are immutable but not
collision-proof after normalization, and the share sheet (one market in
hand) and the SEO generator (whole catalog) must produce identical params
with no coordination. `SharePopover` builds links from the **on-chain EN
title, never `displayTitle`** — a translated slug would miss the emitted
page. The `/m/[id]` route resolves incoming params: embedded
`__viciSeriesId` (guarded for staleness against the param) → bare-id param
→ catalog match on the `~id8` suffix (covers markets newer than the last
deploy); unresolvable params land on the markets board.

## Non-obvious constraints

- **The script must run on every hosting deploy.** `hosting deploy --prune`
  deletes assets missing from `build/` — a deploy without the SEO step wipes
  every previously deployed market page and the sitemap. This is why the
  script _hard-fails_ (failing the deploy) on registry errors, zero visible
  markets, or an `app.html` head tag its patterns no longer match.
- **`app.html` head tags are a contract.** The script rewrites them by
  pattern; rename/restructure them only together with the patterns in the
  script (it fails loudly when they drift, see the comment in `app.html`).
- **The WC reveal gate is replicated, not shared.** Visibility mirrors the
  feed gate (`$lib/utils/wc-schedule.utils`) but derives WC membership from
  the committed deck files (`scripts/data/markets.deck-2026*.json`, matched
  by normalized title) instead of Juno tags, so the script needs no
  satellite access. An unrevealed market's question must never appear in
  the emitted pages or sitemap — that would leak it before its Show Date.
- **Client rendering is unchanged.** The injected pages are byte-identical
  to the shell apart from head tags; the SPA hydrates them like any other
  entry URL. Per-market head content is English (registry `title` /
  `description.plain`), matching the detail page's `<svelte:head>` title
  shape (`{title} | Vici Social Markets`).
- **File count is the binding budget — keep it to ONE page per market.**
  Every emitted file is staged, committed and deleted again per deploy, and
  the satellite recomputes the asset certification tree across all assets
  on bulk operations (junobuild/juno#2263). Deleting ~6k staged assets blew
  the IC's 40B-instruction message limit on the v1.8.14 deploy (change
  applied, cleanup failed → red CI + ~94 MB of orphaned staged assets on
  the prod satellite). The pre-SEO ~3k-file baseline is the proven-safe
  zone; do not add per-market page variants without checking this budget.
- The script skips itself under `JUNO_EMULATOR=true` (E2E deploys have no
  mainnet registry to read).
