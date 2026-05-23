import { Collection } from '$lib/constants/collections.constants';
import { normalizeMarketTags, type MarketTag } from '$lib/constants/market-tags.constants';
import type { MarketMetadata } from '$lib/types/market-metadata';
import { listDocs } from '@junobuild/core';

/**
 * Projects every `MarketMetadata` doc down to `{ seriesId → tags }` so the
 * UI can resolve a market's tags without paying for the full metadata
 * payload (whyNow / events / suggested are not needed for tag lookup).
 *
 * `MARKET_METADATA` is `read: 'public'`, so this works for anonymous
 * viewers too. Unknown tag strings are filtered through
 * {@link normalizeMarketTags} on the client as well as on write (in the
 * satellite) — defense in depth so a stale persisted value can never
 * leak an unknown id into the UI.
 */
export const listMarketTagsBySeries = async (): Promise<Record<string, MarketTag[]>> => {
	const { items } = await listDocs<MarketMetadata>({
		collection: Collection.MARKET_METADATA
	});

	return items.reduce<Record<string, MarketTag[]>>((acc, { data }) => {
		const tags = normalizeMarketTags(data.tags ?? []);

		if (tags.length > 0) {
			acc[data.seriesId] = tags;
		}

		return acc;
	}, {});
};
