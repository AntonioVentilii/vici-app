import { WORLD_CUP_2026 } from '$lib/constants/featured-event.constants';
import {
	normalizeWcQuestion,
	WC_QUESTION_REVEAL_MS
} from '$lib/constants/wc-market-schedule.constants';
import type { Market } from '$lib/types/market';
import { nonNullish } from '@dfinity/utils';

/**
 * Applies the temporary hardcoded World-Cup release schedule
 * (`$lib/constants/wc-market-schedule.constants`) to the live feed.
 *
 * Both helpers gate **only** World-Cup markets — identified by the featured
 * event's category tag — so they are safe to run over any mixed-category
 * list: non-WC markets always pass through.
 */

const WC_TAG = WORLD_CUP_2026.categoryTag;

/**
 * Whether a World-Cup market is visible right now under the release
 * schedule. A market is eligible only once its Show Date has arrived
 * (00:00 UTC); WC markets absent from the schedule are never revealed and
 * stay hidden until curated.
 */
export const isWcMarketRevealed = ({ title, now }: { title: string; now: number }): boolean => {
	const revealMs = WC_QUESTION_REVEAL_MS.get(normalizeWcQuestion(title));

	return nonNullish(revealMs) && now >= revealMs;
};

/**
 * Drops World-Cup markets the release schedule hasn't revealed yet (or
 * doesn't cover at all). Non-WC markets pass through untouched, so this is
 * safe to apply to any mixed-category list before further filtering.
 */
export const filterScheduledWcMarkets = ({
	markets,
	tagsByMarket,
	now
}: {
	markets: Market[];
	tagsByMarket: Record<string, string[]>;
	now: number;
}): Market[] =>
	markets.filter((market) => {
		const isWc = (tagsByMarket[market.id] ?? []).some((tag) => tag === WC_TAG);

		if (!isWc) {
			return true;
		}

		return isWcMarketRevealed({ title: market.title, now });
	});
