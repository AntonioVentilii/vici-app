import { suggestedScore } from '$lib/services/market.services';
import type { CallSide, Market } from '$lib/types/market';
import type { MarketMetadata, MarketWhyNow } from '$lib/types/market-metadata';

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
