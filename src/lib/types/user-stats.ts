import type { MarketTag } from '$lib/constants/market-tags.constants';
import type { PrincipalText } from '@junobuild/schema';

/**
 * Per-category accuracy bucket. The Dash renders one of these per
 * market tag the user has called on.
 */
export interface CategoryStatsBucket {
	calls: number;
	wins: number;
}

/**
 * Compact snapshot of one settled call. The Dash's "Past history"
 * tile renders these in chronological order.
 */
export interface RecentSettlementSnapshot {
	/** Series / market id the user called on. */
	marketId: string;
	/** Market category tag (one of `MARKET_TAGS`). `''` if untagged. */
	tag: MarketTag | '';
	/** `true` if the user's side matched the resolved outcome. */
	win: boolean;
	/** UTC ms timestamp of the settlement event. */
	settledAtMs: number;
	/**
	 * Realized VXP for this settlement, in whole VXP (rounded). Derived
	 * from the clearing `Settled` event's `qty` × execution `price` — the
	 * same product the profile sync uses for lifetime realized P&L — so a
	 * winning settlement carries the positive payout the Oracle insight
	 * surfaces ("+{vxp} VXP"). `≥ 0` for a win.
	 */
	vxp: number;
	/**
	 * `true` when the user took this side against the crowd: a win whose
	 * execution price priced their side as a long shot (≤
	 * `CONTRARIAN_PRICE_THRESHOLD`). Lets the Oracle insight tag the call
	 * a "contrarian win" vs a plain "best call". Mirrors the long-shot
	 * rule the `contrarian` achievement counts on.
	 */
	contrarian: boolean;
}

/**
 * Per-user dashboard cache. Stored under `USER_STATS` keyed by the
 * caller's principal. The FE writes this from `calculateAndSyncStats`
 * after re-aggregating the user's clearing history.
 *
 * `categoryStats` is keyed by market tag; missing tags render as
 * "0 calls" on the Dash. `recentSettlements` is capped at
 * {@link USER_STATS_RECENT_LIMIT} so the doc stays bounded.
 */
export interface UserStatsDoc {
	owner: PrincipalText;
	categoryStats: Record<string, CategoryStatsBucket>;
	recentSettlements: RecentSettlementSnapshot[];
	/** UTC ms timestamp of the last sync. Lets the FE show "as of …". */
	computedAtMs: number;
}

/**
 * Recent-settlements cap. 10 fits the Dash history tile comfortably
 * and keeps the doc payload tight (~600 bytes worst case).
 */
export const USER_STATS_RECENT_LIMIT = 10;
