import type { ClearingDid } from '$declarations';
import { ZERO } from '$lib/constants/app.constants';
import { primaryMarketTag, type MarketTag } from '$lib/constants/market-tags.constants';
import type { CallSide, MarketId } from '$lib/types/market';
import type {
	CategoryAccuracySignal,
	PriorCallSignal,
	UserMarketSignals
} from '$lib/types/market-signals';
import {
	FLOW_ART_CATEGORY_SET,
	resolveFlowArtCategory,
	type FlowArtCategory
} from '$lib/utils/flow-art.utils';
import { decimalFixedValueToNumber } from '$lib/utils/format.utils';
import { parseMarketId } from '$lib/validation/market.validation';

const isExecuted = (event: ClearingDid.Event): boolean => 'Executed' in event.event_type;
const isSettled = (event: ClearingDid.Event): boolean => 'Settled' in event.event_type;
const isWin = (event: ClearingDid.Event): boolean => isSettled(event) && event.qty > ZERO;

const eventSide = (event: ClearingDid.Event): CallSide => (event.qty >= ZERO ? 'YES' : 'NO');

const eventCategory = ({
	event,
	tagsBySeries
}: {
	event: ClearingDid.Event;
	tagsBySeries: Record<string, MarketTag[]>;
}): FlowArtCategory => {
	const marketId = parseMarketId(event.series_id);
	const primary = primaryMarketTag(tagsBySeries[marketId]);

	if (primary !== undefined && FLOW_ART_CATEGORY_SET.has(primary)) {
		return primary;
	}

	return resolveFlowArtCategory({ categoryId: primary, seed: marketId });
};

const formatWhen = (timestampNs: bigint): string => {
	const date = new Date(Number(timestampNs / 1_000_000n));

	if (Number.isNaN(date.getTime())) {
		return '';
	}

	return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const eventConsensus = (event: ClearingDid.Event): number | undefined => {
	const value = decimalFixedValueToNumber({
		value: event.price.decimal.value,
		decimals: event.price.decimal.decimals
	});

	if (!Number.isFinite(value)) {
		return;
	}

	return Math.max(0, Math.min(1, value));
};

export const deriveCategoryAccuracySignals = ({
	events,
	tagMappings
}: {
	events: ClearingDid.Event[];
	tagMappings: Record<string, MarketTag[]>;
}): Partial<Record<FlowArtCategory, CategoryAccuracySignal>> => {
	const bucket = new Map<FlowArtCategory, { calls: number; wins: number }>();

	for (const event of events.filter(isSettled)) {
		const category = eventCategory({ event, tagsBySeries: tagMappings });
		const current = bucket.get(category) ?? { calls: 0, wins: 0 };
		current.calls += 1;
		current.wins += isWin(event) ? 1 : 0;
		bucket.set(category, current);
	}

	const signals: Partial<Record<FlowArtCategory, CategoryAccuracySignal>> = {};

	for (const [category, { calls, wins }] of bucket.entries()) {
		signals[category] = {
			category,
			calls,
			wins,
			accuracy: calls > 0 ? wins / calls : 0
		};
	}

	return signals;
};

export const derivePriorCallSignals = (
	events: ClearingDid.Event[]
): Partial<Record<MarketId, PriorCallSignal>> => {
	const priorCalls: Partial<Record<MarketId, PriorCallSignal>> = {};
	const latestTimestampByMarket = new Map<MarketId, bigint>();

	for (const event of events) {
		if (isExecuted(event)) {
			const marketId = parseMarketId(event.series_id);
			const previous = latestTimestampByMarket.get(marketId);

			if (previous === undefined || event.timestamp > previous) {
				latestTimestampByMarket.set(marketId, event.timestamp);
				priorCalls[marketId] = {
					marketId,
					side: eventSide(event),
					when: formatWhen(event.timestamp),
					consensusThen: eventConsensus(event)
				};
			}
		}
	}

	return priorCalls;
};

/**
 * Trade-history-derived signals (category accuracy + prior calls). The
 * friends-lean signal is sourced separately from the clearing canister's
 * privacy-preserving `aggregate_lean` query — see
 * `$lib/services/followed-lean.services` — and merged in by the caller, so
 * it is not produced here.
 */
export const deriveUserMarketSignals = ({
	events,
	tagMappings
}: {
	events: ClearingDid.Event[];
	tagMappings: Record<string, MarketTag[]>;
}): Omit<UserMarketSignals, 'followedLean'> => ({
	categoryAcc: deriveCategoryAccuracySignals({ events, tagMappings }),
	priorCalls: derivePriorCallSignals(events)
});
