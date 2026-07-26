import { WORLD_CUP_2026 } from '$lib/constants/featured-event.constants';
import type { Market } from '$lib/types/market';
import { isNullish } from '@dfinity/utils';

/**
 * Release gating driven by each market's on-chain trading-window start
 * (`start_ns`, surfaced as {@link Market.startDate}). A scheduled market is
 * discoverable on-chain but withheld from every feed surface (Flow deck, Markets
 * board) until its start instant; a market with no start is live and always
 * shown.
 *
 * Both helpers gate **only** World-Cup markets — identified by the featured
 * event's category tag — so they are safe to run over any mixed-category list:
 * non-WC markets always pass through. The WC scope is deliberate for now; the
 * underlying `startDate` check is general and could drop the tag once scheduled
 * starts are used beyond the World Cup.
 */

/**
 * Whether a market is revealed right now under its release start. Reveal is
 * inclusive at the start (`now >= startDate`). `now` is the client clock, so
 * this best-effort tracks the on-chain trading gate rather than guaranteeing it:
 * under clock skew or a near-boundary race the UI can reveal a beat early, and a
 * trade then rejects with `SeriesNotStarted`. A market with no `startDate` is
 * live from registration and always revealed.
 */
export const isMarketRevealed = ({
	startDate,
	now
}: {
	startDate?: bigint;
	now: number;
}): boolean => isNullish(startDate) || now >= Number(startDate);

/**
 * Drops World-Cup markets whose release start hasn't arrived yet. Non-WC markets
 * pass through untouched, so this is safe to apply to any mixed-category list
 * before further filtering.
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
		// Generalized 2026-07-26: scheduled starts are no longer WC-only (topical
		// drops carry per-wave start_ns) — ANY market with a future startDate stays
		// hidden until its release, whatever its tags. `tagsByMarket` is kept for
		// call-site compatibility; the WC tag no longer changes behaviour.
		void tagsByMarket;

		return isMarketRevealed({ startDate: market.startDate, now });
	});
