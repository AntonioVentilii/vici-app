import type { MarketId } from '$lib/types/market';
import type { FlowArtCategory } from '$lib/utils/flow-art.utils';

export interface CategoryAccuracySignal {
	category: FlowArtCategory;
	accuracy: number;
	calls: number;
	wins: number;
}

export interface PriorCallSignal {
	marketId: MarketId | string;
	side: string;
	when: string;
	consensusThen?: number;
}

export interface FollowedLeanSignal {
	marketId: MarketId | string;
	yes: number;
	total: number;
}

export interface UserMarketSignals {
	categoryAcc: Partial<Record<FlowArtCategory, CategoryAccuracySignal>>;
	priorCalls: Record<string, PriorCallSignal>;
	followedLean: Record<string, FollowedLeanSignal>;
}
