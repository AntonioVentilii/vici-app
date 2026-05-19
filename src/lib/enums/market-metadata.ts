export const MarketWhyNowKind = {
	CLOSING: 'closing',
	TRENDING: 'trending',
	NEW: 'new',
	TOPICAL: 'topical',
	SOCIAL: 'social'
} as const;

export type MarketWhyNowKind = (typeof MarketWhyNowKind)[keyof typeof MarketWhyNowKind];

export const MarketEventDirection = {
	UP: 'up',
	DOWN: 'down'
} as const;

export type MarketEventDirection = (typeof MarketEventDirection)[keyof typeof MarketEventDirection];
