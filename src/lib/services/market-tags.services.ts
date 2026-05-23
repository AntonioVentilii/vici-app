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

/**
 * Full `seriesId → MarketMetadata` projection for the same public
 * `MARKET_METADATA` collection. Powers surfaces that need the entire
 * payload (suggested-market boost, the per-card Featured chip, the
 * "Suggested for you" rail) without forcing a per-card round-trip.
 *
 * Tags on each entry are re-normalised on the client for the same
 * defense-in-depth reason as {@link listMarketTagsBySeries}.
 */
export const listMarketMetadataBySeries = async (): Promise<Record<string, MarketMetadata>> => {
	const { items } = await listDocs<MarketMetadata>({
		collection: Collection.MARKET_METADATA
	});

	return items.reduce<Record<string, MarketMetadata>>((acc, { data }) => {
		acc[data.seriesId] = {
			...data,
			tags: normalizeMarketTags(data.tags ?? [])
		};

		return acc;
	}, {});
};
