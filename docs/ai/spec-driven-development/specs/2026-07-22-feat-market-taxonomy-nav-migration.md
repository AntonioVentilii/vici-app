# Spec: Market taxonomy — nav, chips, and data migration

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: Draft

## Goal

Make the three-layer taxonomy from `2026-07-22-feat-market-taxonomy-model.md` user-visible: a macro category bar with micro-chip sub-filters on the markets browse surface, category chips on cards/detail, and migrate all existing markets + decks onto micro ids — rendering only categories that have live markets.

## Context

Builds directly on `src/lib/constants/market-taxonomy.constants.ts` (Spec A). Surfaces that consume the legacy flat tags today (to be repointed at the taxonomy helpers):

- Color/label/art: `src/lib/utils/tag-color.utils.ts`, `src/lib/utils/market-tags.utils.ts`, `src/lib/utils/flow-art.utils.ts` (+ `CategoryGlyph.svelte`, `FlowArtFrame.svelte`).
- Cards/detail: `MarketCard.svelte`, `MarketsListRow.svelte`, `MarketsFeaturedCard.svelte`, `StackedMarketCard.svelte`, `routes/(app)/markets/[id]/+page.svelte`.
- Board/nav: `src/lib/components/pages/MarketsPage.svelte` (currently chip-less, hardcodes `wc`); build the `MarketsCategoryChips` (macro bar + micro chips) described in `docs/prototype-parity-audit.md`.
- Admin: `MarketMetadataForm.svelte` + `metadata/MetadataShowcaseTab.svelte`, `AdminBulkMarketForm.svelte`.
- Leagues: `CreateBoutModal.svelte` (scope a bout by macro/micro).
- Stores/services: `market-tags.store.ts`, `market-tags.derived.ts`, `market-tags.services.ts`.
- Stats: `UserStatsDoc.categories` / `CategoryStatsBucket` (`src/lib/types/user-stats.ts`, `src/satellite/services/league-stats.services.ts`, `battle.services.ts`).
- Data: `scripts/data/*.json` (`categories` field), `scripts/tag-markets.sh`.
- Satellite: `market-metadata.services.ts` (`normalizeMarketTags`), `market-tag-index.services.ts`, `battle-resolution.services.ts`.
- Cockpit (separate `vici-cockpit` repo): consumes `app_get_market_tags`.

## Scope

- Repoint color/label/art/card/detail surfaces at `macroColor`/`microColor`, `macroLabelKey`/`microLabelKey`, `primaryMicro`/`primaryMacro`.
- `MarketsCategoryChips`: macro bar → micro sub-chips; a chip renders only when its `market_tag_index` bucket is non-empty (`populatedMacros` / `populatedMicros` derived store). Macro filter = union of its micros.
- Admin metadata form: macro→micro cascading picker writing micro ids (primary first) + free-tag input.
- Migrate `MarketMetadata.tags` for all existing markets via `LEGACY_TAG_MIGRATION`; re-tag every `scripts/data/*.json` deck (`categories` → micro ids); rebuild `market_tag_index` (`app_rebuild_market_tag_index`).
- Re-key `CategoryStatsBucket` to macro (derived from primary micro).
- Replace `market-tags.constants.ts` usages, then delete it.
- Analytics: add `market_category_filter` (props `macro`, `micro`) to the TS union + Zod mirror; capture via `track`.
- Update `docs/ai/PRODUCT.md` and any tag-index spec references.

### Out of scope

- Structured `classifications` object field on the wire (stays flat `string[]` — Spec A decision). Revisit only if per-path tag scoping is needed.
- Auto-classification of markets by NLP; deck authors assign micros.

## Technical requirements (satellite / backend)

- **Performance:** no new hooks. `updateMarketTagIndex` already diffs old/new tags per write; micro ids are just more distinct bucket keys. `app_rebuild_market_tag_index` is a one-shot admin scan (unchanged cost profile).
- **Memory & storage:** `market_tag_index` grows from ≤7 buckets to ≤69 (one doc per populated micro) — negligible. No new collection. Doc shape unchanged (`{ tag, seriesIds[], updatedAtMs }`); "tag" now holds a micro id.
- **Scalability:** bucket count bounded by the closed micro set (69). Battle scoping by macro fans out over that macro's micros (≤14) — bounded, no N+1 over markets.
- **Upgrade & compatibility:** **non-breaking** — no `.did` / bindings change (flat `string[]` preserved). The only migration is data: rewrite `MarketMetadata.tags` values + rebuild the index. Cockpit change is coordinated but wire-compatible (same endpoint, values are now micro ids; cockpit maps micro→macro using the shared taxonomy).
- **Security:** unchanged — `market_metadata` writes stay creator/admin-gated; `market_tag_index` stays controller/endpoint-written.
- **Parameters:** taxonomy lives in `src/lib/constants/market-taxonomy.constants.ts` (Spec A) — do not restate ids/colors here.

## Analytics

Add `market_category_filter` — emitted when a user selects a macro or micro chip. Props: `macro: MacroId`, `micro?: MicroId`. Bounded vocab (closed enums), no PII. Lands in both `src/lib/types/analytics-event.ts` and `src/lib/schema/analytics-event.schema.ts`; captured via `track` in `analytics.services.ts`.

## Implementation outline

1. Derive `populatedMacros` / `populatedMicros` from the tag index in `market-tags.derived.ts`.
2. Repoint utils (color/label/art) → taxonomy helpers; delete legacy `TAG_COLORS`/`MARKET_TAG_LABEL_KEYS`.
3. Build `MarketsCategoryChips`; wire into `MarketsPage` (replace the hardcoded `wc` focus).
4. Cascading macro→micro admin picker.
5. Data migration script (existing docs) + deck re-tag + `app_rebuild_market_tag_index`.
6. Re-key `CategoryStatsBucket`; coordinate `vici-cockpit` micro→macro mapping.
7. Delete `market-tags.constants.ts`; update `PRODUCT.md`.

## Acceptance criteria

- [ ] Markets browse shows a macro bar + micro chips; only populated categories appear.
- [ ] Cards/detail show the primary micro's label and macro color.
- [ ] All existing markets + decks carry micro ids; `market_tag_index` rebuilt; no market is orphaned (every one has ≥1 micro).
- [ ] `market-tags.constants.ts` deleted; no references remain.
- [ ] Cockpit still classifies sport/non-sport correctly against micro→macro.
- [ ] `npm run quality` + `npm run check` green; `market_category_filter` fires on chip select.

## Open questions

- Does `vici-cockpit`'s classifier read raw tag strings or already map through a shared list? Confirm before changing the endpoint's value vocabulary (it stays the same endpoint, but values become micro ids).
- `wc`-specific gating (the "Beyond the Cup" skill-gate in `MarketsBeyondCupCard`, `MarketsPage` `wc` focus, FlowArt `wc` special-case) — how much of the World-Cup launch framing survives once `wc` becomes `soccer` + `world-cup` tag?

## Pending decisions

- Closed-market re-tagging: migrate historical/settled markets too, or only live ones? (Affects leaderboard category stats for past wins.)
- Whether macro-scoped battles (`CreateBoutModal`) should offer macro-only, micro-only, or both granularities.
