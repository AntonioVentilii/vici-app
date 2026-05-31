import type { CallSide, MarketId } from '$lib/types/market';

export type XpPopKind = 'normal' | 'bonus';

/**
 * One settled call in the "while you were away" digest — a row in the Flow
 * entry recap and the {@link ResolutionRevealData} list. `side` is the side
 * the user held ('YES' / 'NO' / a categorical outcome title), `result` is the
 * tri-state outcome ('won' | 'lost' | 'neutral'), and `net` is the realized
 * VXP cashflow (positive on a win, zero on neutral, negative on a loss)
 * already scaled to whole VXP. `won` is kept as a convenience alias
 * (`result === 'won'`) for templates that only branch on won vs. not-won.
 */
export interface ResolutionItem {
	eventId: bigint;
	marketId: MarketId;
	question: string;
	side: string;
	sideKey: 'yes' | 'no' | 'hold';
	result: 'won' | 'lost' | 'neutral';
	/** Convenience alias for `result === 'won'`. */
	won: boolean;
	net: number;
}

/**
 * Aggregate of every call that settled since the user last acknowledged their
 * resolutions. Drives both the Flow entry away-digest and the
 * {@link ResolutionReveal} overlay (which the Dashboard banner opens). A
 * `count` of 0 means there is nothing new to settle — the Flow entry falls
 * back to the deck-shuffle loading state and the Dashboard banner hides.
 */
export interface ResolutionRevealData {
	items: ResolutionItem[];
	count: number;
	wins: number;
	losses: number;
	neutrals: number;
	netVxp: number;
}

export interface XpPop {
	id: number;
	amount: number;
	combo: number;
	side: CallSide;
	// 'bonus' = milestone reward (laurel, larger, paired copy).
	kind: XpPopKind;
	// Paired copy ("First call.", "Ten deep.") shown above the
	// number on bonus pops; undefined for normal pops.
	copy?: string;
}
