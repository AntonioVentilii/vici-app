import type { CallSide, MarketId } from '$lib/types/market';

export type XpPopKind = 'normal' | 'bonus';

/**
 * One settled call in the "while you were away" digest — a row in the Flow
 * entry recap and the {@link ResolutionRevealData} list. `side` is the side
 * the user held ('YES' / 'NO' / a categorical outcome title), `won` reflects
 * the realized outcome, and `net` is the realized VXP cashflow (positive on a
 * win, negative on a loss) already scaled to whole VXP.
 */
export interface ResolutionItem {
	eventId: bigint;
	marketId: MarketId;
	question: string;
	side: string;
	sideKey: 'yes' | 'no' | 'hold';
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
