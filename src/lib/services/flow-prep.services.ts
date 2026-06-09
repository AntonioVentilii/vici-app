import type { ClearingDid, RegistryDid } from '$declarations';
import { getUserMarketSignals } from '$lib/services/market-signals.services';
import { deriveTagsBySeries, listMarketMetadataBySeries } from '$lib/services/market-tags.services';
import { enrichFlowMarketsWithOrderBook, getFlowQueue } from '$lib/services/market.services';
import { getUserTradeHistory } from '$lib/services/trade.services';
import type { Market, MarketId } from '$lib/types/market';
import type { MarketMetadata } from '$lib/types/market-metadata';
import type { UserMarketSignals } from '$lib/types/market-signals';
import { deriveCalledMarketIds } from '$lib/utils/market-signals.utils';
import { filterScheduledWcMarkets } from '$lib/utils/wc-schedule.utils';
import { isNullish, nonNullish } from '@dfinity/utils';

/**
 * Deck size matches the historical cap in `FlowMode.svelte`. Kept
 * in this module so the pre-warmed payload is already trimmed to
 * what the component will actually consume.
 */
export const MAX_MARKETS = 20;

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
	/**
	 * The user's home country (ISO region of their active locale). When it
	 * matches a featured-event participant, that country's markets are
	 * boosted in the ranker — see `getFlowQueue` / `rankMarkets`.
	 */
	countryCode?: string;
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
	exclude = [],
	countryCode
}: PrepareFlowOpts): Promise<PreparedFlow> => {
	// Tags and full metadata both project the same public
	// `MARKET_METADATA` collection, so scan it once and derive the tag
	// map locally instead of issuing a second identical full-collection
	// scan (`listMarketTagsBySeries`). The shared promises are awaited in
	// parallel inside each callee via `Promise.all`, so the dependent
	// calls still overlap with the rest of their fetches (markets,
	// profile, trade history, follows) — only the duplicate I/O is removed.
	const metadataPromise = listMarketMetadataBySeries().catch(() => ({}));
	const tagsPromise = metadataPromise.then(deriveTagsBySeries);

	const queuePromise = getFlowQueue({
		domain,
		tagMappings: tagsPromise,
		metadataBySeries: metadataPromise,
		countryCode
	});

	// Markets the viewer has already called drop out of the deck entirely:
	// re-serving a card they've predicted on is the "Flow keeps showing the
	// same cards" bug (#595). Derived from the *full* certified trade history
	// (not the deck slice), so a call from any earlier day or session counts —
	// the per-deck `exclude` set only spans the immediately-previous deck and
	// resets on reload, which is why prior calls leaked back in. Shared with
	// the signals fetch below so the history round-trip is issued once.
	const tradeHistoryPromise: Promise<ClearingDid.Event[]> = signedIn
		? getUserTradeHistory(domain).catch(() => [])
		: Promise.resolve([]);
	const priorCallIdsPromise = tradeHistoryPromise.then(deriveCalledMarketIds);

	// Compose the deck (featured scope → prior-call exclude → seen exclude →
	// slice) up front so `deckIds` — which scopes the followed-lean fan-out —
	// matches the markets actually rendered. Deriving the ids off the *full*
	// queue would scope the lean to candidates the filters then drop, silently
	// starving the promoted markets of their friends-lean row.
	const deckPromise = (async (): Promise<Market[]> => {
		const [queue, tagMap, priorCallIds] = await Promise.all([
			queuePromise,
			tagsPromise,
			priorCallIdsPromise
		]);
		const tagsByMarket = tagMap as Record<string, string[]>;
		const excludeSet = new Set(exclude);

		// Temporary hardcoded World-Cup release schedule: a WC market is
		// withheld until its Show Date (00:00 UTC), and WC markets absent
		// from the calendar stay hidden entirely. Applied to the whole
		// queue up front so withheld markets can't leak back in through the
		// featured-scope fallback below. Non-WC markets pass through.
		const visibleQueue = filterScheduledWcMarkets({
			markets: queue,
			tagsByMarket,
			now: Date.now()
		});

		// When a featured event is active, narrow to markets carrying
		// the event's category tag so the swipe deck tracks the live
		// tentpole. Fall back to the full queue when the filter would
		// empty the deck — users always see *some* content.
		const eventScoped = !isNullish(featuredEventTag)
			? visibleQueue.filter((market) =>
					(tagsByMarket[market.id] ?? []).some((tag) => tag === featuredEventTag)
				)
			: [];
		const sourceQueue = eventScoped.length > 0 ? eventScoped : visibleQueue;

		// Hard filter, no recycle: if the viewer has genuinely called every
		// open market, the empty deck is the *correct* surface ("you're all
		// caught up"). Recycling here would reintroduce the exact cards #595 is
		// about.
		const afterPrior =
			priorCallIds.size > 0 ? sourceQueue.filter((m) => !priorCallIds.has(m.id)) : sourceQueue;

		const afterExclude =
			excludeSet.size > 0 ? afterPrior.filter((m) => !excludeSet.has(m.id)) : afterPrior;
		// Recycle the prior-call-filtered queue (never the already-called
		// markets) when the seen-set wipes it but unseen markets still exist.
		// An empty deck must mean "nothing left to call" — never "you've
		// already seen all of them". Without this, a small inventory (open
		// series ≤ MAX_MARKETS) empties the follow-up deck the moment the prior
		// deck is excluded, landing re-entry on the empty state. Mirrors the
		// event-scope fallback above.
		const filtered = afterExclude.length > 0 ? afterExclude : afterPrior;

		// Slice to the deck cap *before* enrichment so the order-book
		// fan-out is bounded by `MAX_MARKETS` instead of by the total
		// number of open series. The ranker doesn't need book data
		// (see `getFlowQueue`), so the lite list is sufficient to pick
		// the top-N — we only pay the round-trips for what we display.
		return filtered.slice(0, MAX_MARKETS);
	})();
	const deckIdsPromise = deckPromise.then((deck) => deck.map((m) => m.id));

	const [deck, signals, tagMap, metadataBySeries] = await Promise.all([
		deckPromise,
		signedIn
			? getUserMarketSignals({
					domain,
					marketIds: deckIdsPromise,
					tagMappings: tagsPromise,
					tradeHistory: tradeHistoryPromise
				}).catch(() => EMPTY_SIGNALS)
			: Promise.resolve(EMPTY_SIGNALS),
		tagsPromise,
		metadataPromise
	]);

	const tagsByMarket = tagMap as Record<string, string[]>;
	const markets = await enrichFlowMarketsWithOrderBook(deck);

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
		excludedIds: [...new Set(exclude)],
		builtAtMs: Date.now()
	};
};
