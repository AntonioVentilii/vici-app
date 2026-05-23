import type { CallSide } from '$lib/types/market';

export type XpPopKind = 'normal' | 'bonus';

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
