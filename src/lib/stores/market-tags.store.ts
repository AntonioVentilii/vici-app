import type { MarketTag } from '$lib/constants/market-tags.constants';
import { writable } from 'svelte/store';

/**
 * Per-market tag projections — `seriesId → MarketTag[]` (0..N tags per
 * market). Tags live on `MarketMetadata` (collection `MARKET_METADATA`)
 * but most consumers (FlowMode, MarketsPage, PortfolioPage, signals)
 * only need the lookup and never the rest of the metadata payload — so
 * we project once into this cached lookup at app boot.
 *
 * Public read (no identity, no balance domain). Populated by
 * `LoaderMarketTags` and reused across every surface that previously
 * relied on `categoriesStore` / the deleted `series_categories`
 * collection.
 */
export const marketTagsStore = writable<Record<string, MarketTag[]> | undefined>(undefined);
