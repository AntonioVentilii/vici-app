import type { ClearingDid } from '$declarations';
import type { MarketIdSchema } from '$lib/schema/market.schema';
import type { Token } from '$lib/types/token';
import type { PrincipalText } from '@dfinity/zod-schemas';
import type * as z from 'zod';

export type MarketId = z.infer<typeof MarketIdSchema>;

export type MarketStatus = 'Open' | 'Expired' | 'Resolved';

export type OutcomeId = 'YES' | 'NO' | 'CANCELED' | string;

export type Outcome = OutcomeId;

export interface Market {
	id: MarketId;
	title: string;
	description: string;
	creator: PrincipalText;
	expiryDate: bigint; // timestamp in ms
	createdAt: bigint; // timestamp in ms
	status: MarketStatus;
	outcome?: Outcome;
	outcomes?: {
		id: OutcomeId;
		title: string;
		probability?: number;
		volume?: bigint;
		totalPredictions?: number;
	}[];
	payoffType: 'Binary' | 'Categorical' | 'Call' | 'Put';
	isInviteOnly: boolean;
	inviteList: PrincipalText[];
	totalVolume: bigint;
	yesVolume: bigint;
	noVolume: bigint;
	yesProbability: number;
	noProbability: number;
	bestBid?: number;
	bestAsk?: number;
	bestBidQty?: bigint;
	bestAskQty?: bigint;
	token: Token;
	pricePrecision: number;
	balanceDomain: ClearingDid.BalanceDomain;
}
