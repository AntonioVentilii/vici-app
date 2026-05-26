import { suggestedScore } from '$lib/services/market.services';
import type { CallSide, Market } from '$lib/types/market';
import type { MarketMetadata, MarketWhyNow } from '$lib/types/market-metadata';
import type {
	CategoryAccuracySignal,
	FollowedLeanSignal,
	PriorCallSignal
} from '$lib/types/market-signals';
import type { FlowArtCategory } from '$lib/utils/flow-art.utils';
import { decimalFixedValueToNumber } from '$lib/utils/format.utils';

const compactCount = (value: number): string => {
	if (value >= 1_000_000) {
		const m = value / 1_000_000;

		return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')}M`;
	}

	if (value >= 1_000) {
		const k = value / 1_000;

		return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}K`;
	}

	return String(Math.round(value));
};

/** Volume token units as a calls-style activity label for Flow cards. */
export const formatFlowCallsLabel = ({
	volume,
	decimals
}: {
	volume: bigint;
	decimals: number;
}): string => {
	const n = decimalFixedValueToNumber({ value: volume, decimals });

	if (!Number.isFinite(n) || n <= 0) {
		return '0 calls';
	}

	return `${compactCount(n)} calls`;
};

export const consensusPercent = (market: Market): number =>
	Math.round(Math.max(0, Math.min(1, market.yesProbability)) * 100);

export const consensusSide = (market: Market): CallSide =>
	consensusPercent(market) >= 50 ? 'YES' : 'NO';

export const formatWhyNowChip = (whyNow: MarketWhyNow | undefined): string | undefined => {
	if (!whyNow?.text?.trim()) {
		return;
	}

	return whyNow.text.trim();
};

/**
 * Surfacing predicate for the per-card "Suggested" chip and rail entry.
 * A market is shown as suggested only when {@link suggestedScore}
 * (single source of truth for the sort-tier boost) is non-zero — so
 * resolved markets and markets whose 14-day editorial window has
 * elapsed never display the chip, even if `metadata.suggested` is
 * still `true` in the underlying doc.
 */
export const isMarketSuggested = ({
	market,
	metadata
}: {
	market: Market;
	metadata: MarketMetadata | undefined;
}): boolean => suggestedScore({ market, metadata }) > 0;

export const formatCategoryAccuracyLine = ({
	signal,
	categoryLabel
}: {
	signal: CategoryAccuracySignal;
	categoryLabel: string;
}): string => {
	const pct = Math.round(signal.accuracy * 100);

	return `Your ${categoryLabel} accuracy: ${pct}% (${signal.calls} calls)`;
};

export const formatFollowedLeanLine = (signal: FollowedLeanSignal): string =>
	`Followed predictors: ${signal.yes} of ${signal.total} YES`;

export const formatPriorCallLine = ({
	signal,
	consensusNowPct
}: {
	signal: PriorCallSignal;
	consensusNowPct: number;
}): string => {
	const drift =
		signal.consensusThen !== undefined
			? Math.round((consensusNowPct - Math.round(signal.consensusThen * 100)) * 1) / 1
			: undefined;
	const driftLabel =
		drift !== undefined ? ` · consensus ${drift >= 0 ? '+' : ''}${drift} pts since` : '';

	return `Your prior call: ${signal.side} — ${signal.when}${driftLabel}`;
};

export const sparklinePoints = ({
	yesPercent,
	seed,
	eventCount = 7
}: {
	yesPercent: number;
	seed: string;
	eventCount?: number;
}): number[] => {
	let h = 0;

	for (let i = 0; i < seed.length; i++) {
		h = (h * 31 + seed.charCodeAt(i)) | 0;
	}

	const points: number[] = [];
	const base = Math.max(5, Math.min(95, yesPercent));

	for (let i = 0; i < eventCount; i++) {
		h = (h * 1_664_525 + 1_013_904_223) | 0;
		const jitter = ((h >>> 0) % 17) - 8;
		points.push(Math.max(4, Math.min(96, base + jitter - (eventCount - 1 - i) * 2)));
	}

	points[points.length - 1] = base;

	return points;
};

export interface FlowCardContext {
	metadata?: MarketMetadata;
	categoryAcc?: CategoryAccuracySignal;
	priorCall?: PriorCallSignal;
	followedLean?: FollowedLeanSignal;
	categoryLabel: FlowArtCategory;
}
