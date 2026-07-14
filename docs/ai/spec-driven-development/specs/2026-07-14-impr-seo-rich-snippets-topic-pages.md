# Spec: SEO rich snippets, structured data & category topic pages

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: In progress (#PR)

## Goal

Make Vici reachable and attractive in external search results and link
unfurls for category-intent queries like "prediction market world cup".
Today the crawler-facing layer never emits the phrase "prediction
market", carries no structured data, and shows no live figures. This
change adds JSON-LD structured data, data-rich meta descriptions (active
market counts + current odds), and per-category **topic pages** (e.g.
`/predictions/world-cup`) that own category queries the way a Polymarket
"Sports › World Cup" page does — while the rendered product UI keeps
saying "Social Markets", never "prediction market".

Purely the external SEO / SERP / unfurl surface. No change to the in-app
search box.

## Context

The app is a static SPA (`adapter-static`, `ssr = false`); the
crawler-facing surface is generated **at deploy time**. Canonical
overview: `docs/ai/frontend/seo.md`.

- `scripts/build/generate-seo-assets.ts` — the deploy-time generator
  (second `predeploy` step in `juno.config.ts`). Reads the registry
  canister (`registry.list_series`, anonymous `HttpAgent`), filters to
  `engine_id === 'eng_0'`, applies the WC reveal gate from the committed
  decks, and emits `build/sitemap.xml` + one `build/m/{slug~id8}/index.html`
  per visible market by pattern-rewriting the head tags of `build/index.html`.
- `src/app.html` — the brand-generic head every page falls back to; its
  head tags are a **contract** the generator rewrites by regex (it
  hard-fails if a pattern stops matching exactly once).
- `src/lib/utils/market-slug.utils.ts` — `marketShareParam` (`slug~id8`),
  the single source of the `/m/{param}` shape shared by generator + share
  sheet.
- `src/lib/constants/market-tags.constants.ts` — the closed tag taxonomy
  (`MARKET_TAGS = ['wc','macro','crypto','politics','tech','sports','culture']`),
  `MARKET_TAG_LABEL_KEYS`, `primaryMarketTag`.
- `src/declarations/clearing/clearing.idl.js` + `clearing.did` — the
  engine canister. `list_orders` (order-book mid = live YES odds, the FE's
  own odds source) and `stats()` (global totals) are anonymous-readable.
- `MARKET_TAG_INDEX` Juno collection (public read) / satellite query
  `app_get_market_tags` — reverse tag→seriesIds index; `seriesIds.length`
  per tag = per-category counts. Provisioned on prod since 2026-07-07 (see
  the tag-index provisioning note in memory).
- `src/lib/services/market.services.ts` (`enrichMarketsWithOrderBook`,
  `calculateMarketStats`) — how the live UI derives `yesProbability` from
  the order book; the generator will mirror this mid-price computation.
- Existing per-market head shape: `{title} | Vici Social Markets`
  (`market.detail.head_suffix`); home i18n SEO keys `seo.home.*` in
  `src/lib/constants/messages/en.ts`.

## Scope

Four workstreams, one PR.

1. **JSON-LD structured data** (new; none exists today).
   - Home / `app.html`: a `WebSite` + `Organization` `@graph`, static.
     **No `SearchAction`** — a sitelinks search box needs a working in-app
     search endpoint, which is dead code today (deferred with the in-app
     search work).
   - Per-market pages: the generator injects a JSON-LD block — model each
     market as a `Question`/`Claim`-style node (yes/no) carrying `name`
     (title), `text` (description), `url` (canonical), and a `keywords`
     field including "prediction market" + the market's category label.
   - Topic pages: a `CollectionPage` node listing member markets +
     `keywords` ("world cup prediction market", "2026 world cup odds", …).

2. **Data-rich meta descriptions** (counts + odds; decided — no `$`
   volume in v1).
   - Per-market: append current YES odds to the snippet when the order
     book yields a mid ("Community odds: Yes 41%."). Odds read at deploy
     time from clearing `list_orders`; a market with an empty book falls
     back to the current description tail unchanged.
   - Topic pages: description leads with the active-market count
     ("Trade 23 live World Cup prediction markets on Vici. Community
     odds, updated continuously.").

3. **Per-category topic pages** (new surface).
   - Generator emits a static shell at
     `build/predictions/{slug}/index.html` (slug per `TOPIC_SLUG_BY_TAG`,
     e.g. `world-cup`) with rich title / description and
     `CollectionPage` + `BreadcrumbList` + `ItemList` JSON-LD. **v1 emits
     World Cup only** — membership is deck-derived (as the reveal gate
     already is), needing no tag access. The Juno tag index for the other
     tags is admin-gated (see Decisions), so the anonymous generator can't
     read it; other tags defer.
   - No body-HTML injection: SSR is off app-wide and Googlebot renders JS,
     so the head + JSON-LD carry the crawl signal and the real route
     renders the visible board. (Dropped the "crawlable body block" idea —
     it risked a hydration flash for no Google benefit.)
   - New SvelteKit route
     `src/routes/(app)/predictions/[tag]/+page.svelte` resolving the slug
     via `tagFromTopicSlug`, rendering the existing markets board **scoped
     to that tag** with an `<h1>` intro; unknown slug → `/app`. Placed
     inside `(app)` and exempted from the sign-in gate (mirrors the
     `/markets/` public exemption) so it inherits `<Loaders>` and renders
     for signed-out visitors.

4. **Sitemap & shell polish**.
   - Add the topic-page URLs to `sitemap.xml`; add `<lastmod>` (deploy
     timestamp) and per-URL-type `<changefreq>`/`<priority>`.
   - Enrich the static `app.html` description/OG to include "prediction
     market" (meta only) and add the JSON-LD from workstream 1.

### Out of scope

- **In-app search box** — the unused `src/lib/utils/search.utils.ts`,
  tag indexing, and synonym mapping. Decided: separate spec/PR. The
  JSON-LD `SearchAction` waits on this too.
- **Topic pages for tags other than World Cup** — `MARKET_TAG_INDEX` /
  `app_get_market_tags` is admin-gated, so the anonymous deploy script
  can't read tag membership for macro/crypto/politics/tech/sports/culture.
  The route + `TOPIC_SLUG_BY_TAG` already generalise to all tags; only the
  generator's static-page emission is WC-only. Fast-follow: read public
  `MARKET_METADATA` (anonymous) or run the generator under an admin
  identity.
- **`seo_topic_page_viewed` analytics** — deferred (see Analytics).
- **`$` trading-volume in snippets** — clean cumulative volume
  (`list_series_traded_volumes`) is anonymous-guarded and would need the
  deploy to run under a controller identity. Deferred; revisit as a
  fast-follow if odds+counts underperform.
- **Per-team / per-entity records** ("England 5-0, 83% win rate") — Vici
  markets are per-question, not modeled around team entities, and no
  per-market win-rate is computed anywhere. Not buildable without new
  aggregation; out of scope.
- **Live freshness / SSR** — all baked figures are a snapshot as of the
  last deploy. No move to SSR/edge rendering.
- **Non-English meta** — per-market head stays English (registry title),
  as today.

## Linked issues

Searched open issues for "SEO" — none found. No linked issue.

## Analytics

**Deferred to a fast-follow — deliberately, with reason.** The topic page
is a new landing surface and a `seo_topic_page_viewed` event would be the
natural instrument (reusing the bounded `label`/`count` props — no new
prop keys). But the analytics event **name** is a Candid variant in the
satellite's generated API (`AnalyticsEventNameSchema` →
`satellite.did`/declarations), so adding one couples this frontend +
build-script change to a **satellite wasm rebuild + regenerated
bindings**. Keeping this PR off the satellite schema keeps it small and
low-risk, and avoids a `satellite-schema` CI dependency on a wasm regen.
Interim signal: the auto-attached `path` on existing events and server
request logs show `/predictions/*` traffic. Add the event in a follow-up
that owns the regen.

The deploy-time generator emits no analytics (build step, no user).

## Technical requirements (deploy-time canister/collection reads)

Not a satellite-schema change — no new collections, no doc-shape change,
no `.did`/bindings regen, no writes. It **adds read-only, anonymous
deploy-time reads** to the generator:

- **Performance / call frequency** — once per deploy. Adds, per deploy:
  registry `list_series_with({only_unexpired})` (or reuse the existing
  `list_series` pass), one `list_orders` per visible market (batchable /
  bounded by catalog size, ~hundreds), one `stats()`, one
  `MARKET_TAG_INDEX` read (or `app_get_market_tags`). All query calls; no
  update calls; no instruction-budget concern on the satellite side (the
  40B-instruction risk in `seo.md` is about **asset certification on bulk
  file ops**, not query reads — the +~7 topic files keep us inside the
  proven-safe file-count zone).
- **Failure mode** — generator stays fail-fatal (a degraded run wipes the
  deployed SEO surface under `--prune`). New reads must hard-fail the
  deploy on error, matching the existing registry-read contract. Odds are
  the one soft-fail: a market with no order book simply omits the odds
  clause rather than failing.
- **Security** — all reads are public/anonymous; no controller identity
  introduced (that was the volume path we deferred).
- **Parameters** — tag taxonomy from
  `src/lib/constants/market-tags.constants.ts`; canister ids from
  `src/lib/constants/canisters.constants.ts`. Do not restate values.

## Implementation outline

1. **Shared odds helper for the generator** — add a clearing actor
   (mirror the registry actor setup) and a `midYesProbability(orders)`
   that reuses the same mid-price logic as `calculateMarketStats`
   (`market.services.ts`); factor the pure computation so FE + generator
   share it rather than duplicating.
2. **Per-market meta enrichment** — in `renderMarketShell`, extend
   `composeDescription` to append the odds clause when a mid exists; add
   a JSON-LD injector (new `replaceOnce` on a `<script type="application/ld+json">`
   placeholder added to `app.html`, or inject before `</head>`).
3. **Topic-page generation** — collect the deck-derived WC subset of the
   emitted market set; render a topic shell (title/description +
   `CollectionPage`/`BreadcrumbList`/`ItemList` JSON-LD); write to
   `build/predictions/world-cup/index.html`; push to sitemap.
4. **Topic route** — `src/routes/(app)/predictions/[tag]/+page.svelte`
   resolves the slug via `tagFromTopicSlug` and renders the markets board
   filtered by tag (reuse `markets` / `marketTags` derived + `MarketsListRow`)
   with an `<h1>` and intro copy; exempt `/predictions/` from the `(app)`
   sign-in gate.
5. **Static head + sitemap polish** — add `WebSite`/`Organization`
   JSON-LD + "prediction market" keyword to `app.html`; add
   `lastmod`/`changefreq`/`priority` to `renderSitemap`; add topic URLs.
6. **Docs** — update `docs/ai/frontend/seo.md` (new page types, the
   clearing/tag-index reads, JSON-LD contract) and `docs/ai/PRODUCT.md`
   (the SEO/topic-page behaviour) in this PR.

## Acceptance criteria

- [ ] `WebSite` + `Organization` JSON-LD is present on the home shell
      (`app.html`) and validates on the Rich Results Test.
- [ ] Each emitted `build/m/{slug~id8}/index.html` contains valid
      per-market JSON-LD (`WebPage` + `BreadcrumbList`) and, when the order
      book has a mid, an odds clause in the meta description.
- [ ] `build/predictions/world-cup/index.html` is emitted (when ≥1 WC
      market is revealed) with a title/description containing "prediction
      market" and valid `CollectionPage` + `BreadcrumbList` + `ItemList`
      JSON-LD.
- [ ] `sitemap.xml` lists home, static routes, every visible market, and
      the WC topic page, each with `lastmod`.
- [ ] `/predictions/world-cup` renders a tag-scoped markets board with an
      `<h1>` for signed-out visitors; unrevealed WC markets never appear
      in the emitted topic page or its sitemap entry; an unknown slug
      redirects to `/app`.
- [ ] The rendered product UI still never displays "prediction market";
      the phrase appears only in `<head>` / JSON-LD.
- [ ] Generator stays fail-fatal on registry read errors; a clearing
      (odds) read failure or an empty order book degrades to no-odds, not
      a failed deploy.
- [ ] `npm run quality` + `npm run check` pass; `docs/ai/frontend/seo.md`
      and `PRODUCT.md` updated in the same PR.

## Open questions

- Verify the emitted JSON-LD against Google's Rich Results Test on prod
  after deploy (the `WebPage`/`CollectionPage`/`BreadcrumbList`/`ItemList`
  graphs are conservative and should validate, but confirm no warnings).

## Decisions

- **Baked snippet data = counts + odds** (no `$` volume in v1) — volume's
  clean source (`list_series_traded_volumes`) is anonymous-guarded and
  staleness risk on money figures is higher; counts+odds are anonymous,
  cheap, and read as representative.
- **External SEO only** — in-app search (and the `SearchAction`) are a
  separate surface/spec.
- **"prediction market" in meta only** — emitted in
  `<title>`/description/JSON-LD to rank for the category query; never in
  the rendered UI, which keeps "Social Markets". Does not touch the
  "prediction not bet" terminology rule.
- **Topic-page URL = `/predictions/{slug}`** (`world-cup`, per
  `TOPIC_SLUG_BY_TAG` next to the taxonomy) — keyword-carrying and
  namespaced; the `wc` tag id expands to the human `world-cup`.
- **v1 topic page = World Cup only** — the tag index for the other
  categories is admin-gated and unreadable by the anonymous deploy script;
  WC membership is deck-derived and needs no tag access. Other tags
  deferred (see Out of scope).
- **Odds are a soft dependency** — a clearing read failure degrades to "no
  odds clause", never a failed deploy; the registry read stays fatal.
- **Analytics deferred** — avoids coupling this PR to a satellite schema
  regen (see Analytics).
