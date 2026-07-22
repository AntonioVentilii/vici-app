# Spec: Market taxonomy model (3 layers)

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: In progress (#1168)

## Goal

Introduce a three-layer market classification — **macro → micro → tag** — modelled on Polymarket's category structure, replacing the flat 7-value tag taxonomy. This spec lands the _model_ (the closed macro/micro enums, derivation helpers, brand colors, and localized labels) as an additive layer with no behaviour change. Wiring the nav/chips UI and migrating existing data is the sibling spec `2026-07-22-feat-market-taxonomy-nav-migration.md` (Draft).

## Context

Today categorisation is a single closed set of 7 tags — `wc, macro, crypto, politics, tech, sports, culture` — defined in `src/lib/constants/market-tags.constants.ts`, stored as `MarketMetadata.tags: string[]` (`src/lib/schema/market-metadata.schema.ts`), reverse-indexed by the satellite `market_tag_index` collection, coloured in `src/lib/utils/tag-color.utils.ts`, labelled via `market.tag.<id>` catalog keys, and rendered through `categoryLabel` / `primaryMarketTag`.

Two of the seven are not peer categories: `macro` is really _Economy_, and `wc` is an event that belongs under _Sports → Soccer_. The set is also too coarse to browse (no way to reach "Bitcoin" or "Tennis"). The deck decks under `scripts/data/*.json` carry a `categories: string[]` field mapped onto `tags` by `scripts/tag-markets.sh`.

Reusability: the new module mirrors the shape and wasm-safety constraints of `market-tags.constants.ts` (see `docs/ai/frontend/reusability.md`), and reuses the existing brand-accent hexes.

## Scope

- New `src/lib/constants/market-taxonomy.constants.ts` — the closed taxonomy:
  - `MARKET_TAXONOMY` (7 macros, each with an ordered `micros` list; 69 micros total), `MacroId` / `MicroId` types, `MACRO_IDS` / `MICRO_IDS`, `MICRO_TO_MACRO`.
  - Guards `isMacroId` / `isMicroId`; helpers `macroOfMicro`, `microsOfMacro`.
  - `MACRO_COLORS` (6 hexes reused from `TAG_COLORS`; `world` inherits the laurel-gold that `wc` used) + `macroColor` / `microColor`.
  - Label-key helpers `macroLabelKey` / `microLabelKey` → `market.macro.<id>` / `market.micro.<id>`.
  - Classification helpers over the stored flat `string[]`: `splitClassification`, `classificationMicros`, `classificationTags`, `primaryMicro`, `primaryMacro`, `classificationMacros` — **first micro = primary**.
  - `LEGACY_TAG_MIGRATION` map (old 7 tags → `{ micro, tags }`) consumed by Spec B.
- Localized labels: `market.macro.*` (7) + `market.micro.*` (69) added to every **live** catalog (`en, es, pt, it, fr, de, zh-Hans`). `soon` catalogs fall back to English.
- Design artifact: `./2026-07-22-feat-market-taxonomy-model/taxonomy.json` (mirror of the TS source, incl. seed Layer-3 tags per micro).

### Storage decision (no wire change)

The stored field stays `MarketMetadata.tags: string[]`. Micro ids and free (Layer-3) tags coexist in that one array; a value is a micro iff `isMicroId(value)` is true, otherwise it is a free tag. A market's macros are **derived** from its micros — no macro field is persisted. This keeps the satellite schema, `.did`, generated bindings, `market_tag_index`, and the cockpit `app_get_market_tags` contract **unchanged**. The order of the array is meaningful: the first micro is the primary classification.

### Out of scope (→ Spec B)

- Rewiring FE surfaces (`tag-color.utils.ts`, `market-tags.utils.ts`, `flow-art.utils.ts`, MarketCard/detail chip, admin `MarketMetadataForm`, `CreateBoutModal`, the `MarketsPage` board + the not-yet-built `MarketsCategoryChips` macro-bar/micro-chip nav).
- Migrating existing `MarketMetadata.tags` data and re-tagging `scripts/data/*.json` decks via `LEGACY_TAG_MIGRATION`; rebuilding `market_tag_index`.
- Deriving `populatedMacros` / `populatedMicros` (chips render only when their index bucket is non-empty).
- `UserStatsDoc.categories` (`CategoryStatsBucket`) re-keying and the cockpit sport/non-sport classification consuming micro→macro.
- Retiring `market-tags.constants.ts` (kept intact so nothing breaks this PR).

## Linked issues

No existing open issue tracks this — new product direction. (Searched repo issues; none matched category/taxonomy.)

## Analytics

No analytics in this spec — it adds constants and labels with no user-facing surface or behaviour to instrument. Instrumentation lands with the browse/filter UI in Spec B, where a `market_category_filter` event (props: `macro`, `micro`) is the proposed addition; that event name will go in both `src/lib/types/analytics-event.ts` and `src/lib/schema/analytics-event.schema.ts`.

## Implementation outline

1. Add `src/lib/constants/market-taxonomy.constants.ts` (above). Keep it wasm-safe: type-only `MessageKey` import, no value import of `$lib/utils/i18n.utils`.
2. Add `market.macro.*` (7) + `market.micro.*` (69) to `src/lib/constants/messages/{en,es,pt,it,fr,de,zh-Hans}.ts`; `en` is source of truth, translate the descriptive labels, keep proper nouns/acronyms verbatim.
3. Commit the design-artifact `taxonomy.json` under the spec's asset folder.
4. `npm run check` (svelte-check) + `npm run quality` (prettier + eslint + `check:i18n`) green.

## Acceptance criteria

- [ ] `market-taxonomy.constants.ts` exports the 7-macro / 69-micro taxonomy with `MacroId` / `MicroId`, guards, `MICRO_TO_MACRO`, colors, label-key + classification helpers, and `LEGACY_TAG_MIGRATION`.
- [ ] Every micro maps to exactly one macro; `primaryMicro`/`primaryMacro` read the first micro; free tags are preserved and excluded from micros.
- [ ] `market.macro.*` and `market.micro.*` exist in all 7 live catalogs; `npm run check:i18n` passes.
- [ ] The module is wasm-safe (no value import pulling locale catalogs).
- [ ] `npm run check` and `npm run quality` pass; no existing behaviour changes (`market-tags.constants.ts` untouched).

## Decisions

- **Multiple classifications with one primary** (not single-home): a market may carry several micros/macros; the first micro is primary for art/color/stats. Matches the existing multi-tag reality (`["crypto","macro"]`) and avoids double-counting.
- **Flat storage, derived macro** (not a structured `classifications` object field): avoids a satellite schema / `.did` / bindings / cockpit change, keeping this a pure-frontend, non-breaking PR. A future spec may promote to a structured field if strict per-path tag scoping is ever needed.
- **Full taxonomy shipped, UI shows only populated** branches (Spec B) — empty micros cost nothing and let decks grow into them without code changes.
- **`world` is a new macro** split out of the old `politics`/`macro` catch-alls; **`economy`** replaces `macro`; **`wc`** demotes to `sports/soccer` + a `world-cup` free tag; **`weather`** + **`novelty`** micros absorb the oddity markets that abused `culture`.
