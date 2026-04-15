export type MarketKindFilter = 'all' | 'challenge' | 'market';
export type MarketPayoutFilter = 'all' | 'vxp' | 'non-monetary';
export type MarketAccessFilter = 'all' | 'open' | 'closed';

export interface MarketSecondaryFilters {
	kind: MarketKindFilter;
	payout: MarketPayoutFilter;
	access: MarketAccessFilter;
}

export const DEFAULT_SECONDARY_FILTERS: MarketSecondaryFilters = {
	kind: 'all',
	payout: 'all',
	access: 'all'
};
