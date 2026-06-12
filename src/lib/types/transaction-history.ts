import type { MarketId } from '$lib/types/market';

/**
 * Award tag decoded from a bonus transfer's ledger memo
 * (`vxp:<tag>:<key>`, written by the satellite payout helper in
 * `src/satellite/utils/vxp-payout.utils.ts`). `unknown` covers transfers
 * that predate the memo format or carry an unrecognized tag — they still
 * render as a generic reward rather than disappearing.
 */
export type TransactionHistoryBonusTag =
	| 'achievement'
	| 'calibration'
	| 'comeback'
	| 'league_founder'
	| 'new-user'
	| 'referral'
	| 'streak'
	| 'tournament_prize'
	| 'worlds_podium'
	| 'unknown';

export type TransactionHistoryKind =
	| 'bonus'
	| 'prediction'
	| 'won'
	| 'lost'
	| 'neutral'
	| 'liquidation'
	| 'received'
	| 'sent'
	| 'minted'
	| 'burned';

export interface TransactionHistoryRow {
	id: string;
	kind: TransactionHistoryKind;
	/** Only set for `bonus` rows. */
	bonusTag?: TransactionHistoryBonusTag;
	/** Only set for clearing-sourced rows. */
	marketId?: MarketId;
	timestampNs: bigint;
	/** Signed spendable-VXP delta, clearing-margin base units. */
	delta: bigint;
	/**
	 * Stake context for `lost` / `neutral` rows — the margin that was
	 * committed on the market (display only; the delta already accounts
	 * for it).
	 */
	stake?: bigint;
	/** Running spendable balance after this event, clearing-margin units. */
	balance: bigint;
}

export type TransactionHistoryFilter = 'all' | 'predictions' | 'results' | 'bonuses';
