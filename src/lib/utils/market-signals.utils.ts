import type { ClearingDid } from '$declarations';
import { ZERO } from '$lib/constants/app.constants';
import { ActivityType } from '$lib/enums/social';
import type { SeriesCategory } from '$lib/types/category';
import type { MarketId } from '$lib/types/market';
import type {
	CategoryAccuracySignal,
	FollowedLeanSignal,
	PriorCallSignal,
	UserMarketSignals
} from '$lib/types/market-signals';
import type { Activity } from '$lib/types/social';
import {
	FLOW_ART_CATEGORIES,
	resolveFlowArtCategory,
	type FlowArtCategory
} from '$lib/utils/flow-art.utils';
import { decimalFixedValueToNumber } from '$lib/utils/format.utils';
import { parseMarketId } from '$lib/validation/market.validation';

const ART_CATEGORY_SET = new Set<string>(FLOW_ART_CATEGORIES);

const isExecuted = (event: ClearingDid.Event): boolean => 'Executed' in event.event_type;
const isSettled = (event: ClearingDid.Event): boolean => 'Settled' in event.event_type;
const isWin = (event: ClearingDid.Event): boolean => isSettled(event) && event.qty > ZERO;

const eventSide = (event: ClearingDid.Event): 'YES' | 'NO' => (event.qty >= ZERO ? 'YES' : 'NO');

const eventCategory = ({
	event,
	categoryBySeries
}: {
	event: ClearingDid.Event;
	categoryBySeries: Map<string, string>;
}): FlowArtCategory => {
	const marketId = parseMarketId(event.series_id);
	const categoryId = categoryBySeries.get(marketId);

	if (categoryId && ART_CATEGORY_SET.has(categoryId)) {
		return categoryId as FlowArtCategory;
	}

	return resolveFlowArtCategory({ categoryId, seed: marketId });
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

const activityOutcome = (details: string | undefined): 'YES' | 'NO' | undefined => {
	const match = /\bon\s+(YES|NO)\b/i.exec(details ?? '');

	return match?.[1]?.toUpperCase() as 'YES' | 'NO' | undefined;
};

export const deriveCategoryAccuracySignals = ({
	events,
	categoryMappings
}: {
	events: ClearingDid.Event[];
	categoryMappings: SeriesCategory[];
}): Partial<Record<FlowArtCategory, CategoryAccuracySignal>> => {
	const categoryBySeries = new Map(categoryMappings.map((m) => [m.seriesId, m.categoryId]));
	const bucket = new Map<FlowArtCategory, { calls: number; wins: number }>();

	for (const event of events.filter(isSettled)) {
		const category = eventCategory({ event, categoryBySeries });
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
 * Derives followed-user lean from the public activity feed available to
 * the current viewer. This intentionally returns a sparse map: if no
 * followed activity is available for a market, the back-card simply
 * omits the followed-predictor row rather than showing invented data.
 */
export const deriveFollowedLeanSignals = (
	activities: Activity[]
): Partial<Record<MarketId, FollowedLeanSignal>> => {
	const bucket = new Map<MarketId, { yes: number; total: number }>();

	for (const activity of activities.filter(
		(a) => Boolean(a.marketId) && a.type === ActivityType.TRADE
	)) {
		const side = activityOutcome(activity.details);

		if (side !== undefined && activity.marketId) {
			const marketId = activity.marketId as MarketId;
			const current = bucket.get(marketId) ?? { yes: 0, total: 0 };
			current.total += 1;
			current.yes += side === 'YES' ? 1 : 0;
			bucket.set(marketId, current);
		}
	}

	const followedLean: Partial<Record<MarketId, FollowedLeanSignal>> = {};

	for (const [marketId, value] of bucket.entries()) {
		followedLean[marketId] = { marketId, ...value };
	}

	return followedLean;
};

export const deriveUserMarketSignals = ({
	events,
	categoryMappings,
	friendActivities = []
}: {
	events: ClearingDid.Event[];
	categoryMappings: SeriesCategory[];
	friendActivities?: Activity[];
}): UserMarketSignals => ({
	categoryAcc: deriveCategoryAccuracySignals({ events, categoryMappings }),
	priorCalls: derivePriorCallSignals(events),
	followedLean: deriveFollowedLeanSignals(friendActivities)
});
