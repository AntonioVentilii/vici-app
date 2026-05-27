import type { RegistryDid } from '$declarations';
import { getUserMarketSignals } from '$lib/services/market-signals.services';
import {
	listMarketMetadataBySeries,
	listMarketTagsBySeries
} from '$lib/services/market-tags.services';
import { enrichFlowMarketsWithOrderBook, getFlowQueue } from '$lib/services/market.services';
import type { Market, MarketId } from '$lib/types/market';
import type { MarketMetadata } from '$lib/types/market-metadata';
import type { UserMarketSignals } from '$lib/types/market-signals';
import { isNullish, nonNullish } from '@dfinity/utils';

/**
 * Deck size matches the historical cap in `FlowMode.svelte`. Kept
 * in this module so the pre-warmed payload is already trimmed to
 * what the component will actually consume.
 */
const MAX_MARKETS = 20;

const EMPTY_SIGNALS: UserMarketSignals = {
	categoryAcc: {},
	priorCalls: {},
	followedLean: {}
};

export interface PreparedFlow {
	markets: Market[];
	metadataById: Map<MarketId, MarketMetadata>;
	tagMap: Record<string, string[]>;
	signals: UserMarketSignals;
	domain: RegistryDid.BalanceDomain;
	featuredEventTag: string | undefined;
	excludedIds: ReadonlyArray<string>;
	builtAtMs: number;
}

export interface PrepareFlowOpts {
	domain: RegistryDid.BalanceDomain;
	featuredEventTag: string | undefined;
	signedIn: boolean;
	exclude?: ReadonlyArray<string>;
}

/**
 * Builds the full payload a Flow session needs to render instantly:
 * the ranked queue (already sliced and featured-event filtered),
 * the tag map, per-market metadata, and user signals.
 *
 * Mirrors what `FlowMode.svelte` used to fetch inline in `onMount`,
 * so a pre-warmed result drops into the component without changing
 * what the deck consumes downstream.
 */
export const prepareFlow = async ({
	domain,
	featuredEventTag,
	signedIn,
	exclude = []
}: PrepareFlowOpts): Promise<PreparedFlow> => {
	// Share the tag and metadata fetches across `getFlowQueue` and
	// `getUserMarketSignals` so we don't pay for them three times per
	// warm. The promises are awaited in parallel inside each callee
	// via `Promise.all`, so the dependent calls still overlap with
	// the rest of their fetches (markets, profile, trade history,
	// follows) — only the duplicate I/O is removed.
	const tagsPromise = listMarketTagsBySeries().catch(() => ({}));
	const metadataPromise = listMarketMetadataBySeries().catch(() => ({}));

	const [queue, signals, tagMap, metadataBySeries] = await Promise.all([
		getFlowQueue({
			domain,
			tagMappings: tagsPromise,
			metadataBySeries: metadataPromise
		}),
		signedIn
			? getUserMarketSignals({ domain, tagMappings: tagsPromise }).catch(() => EMPTY_SIGNALS)
			: Promise.resolve(EMPTY_SIGNALS),
		tagsPromise,
		metadataPromise
	]);

	const tagsByMarket = tagMap as Record<string, string[]>;
	const excludeSet = new Set(exclude);

	// When a featured event is active, narrow to markets carrying
	// the event's category tag so the swipe deck tracks the live
	// tentpole. Fall back to the full queue when the filter would
	// empty the deck — users always see *some* content.
	const eventScoped = !isNullish(featuredEventTag)
		? queue.filter((market) =>
				(tagsByMarket[market.id] ?? []).some((tag) => tag === featuredEventTag)
			)
		: [];
	const sourceQueue = eventScoped.length > 0 ? eventScoped : queue;
	const filtered =
		excludeSet.size > 0 ? sourceQueue.filter((m) => !excludeSet.has(m.id)) : sourceQueue;
	// Slice to the deck cap *before* enrichment so the order-book
	// fan-out is bounded by `MAX_MARKETS` instead of by the total
	// number of open series. The ranker doesn't need book data
	// (see `getFlowQueue`), so the lite list is sufficient to pick
	// the top-N — we only pay the round-trips for what we display.
	const top = filtered.slice(0, MAX_MARKETS);
	const markets = await enrichFlowMarketsWithOrderBook(top);

	const metadataById = new Map<MarketId, MarketMetadata>();
	const metadataByRaw = metadataBySeries as Record<string, MarketMetadata>;

	for (const market of markets) {
		const meta = metadataByRaw[market.id];

		if (nonNullish(meta)) {
			metadataById.set(market.id, meta);
		}
	}

	return {
		markets,
		metadataById,
		tagMap: tagsByMarket,
		signals,
		domain,
		featuredEventTag,
		excludedIds: [...excludeSet],
		builtAtMs: Date.now()
	};
};
