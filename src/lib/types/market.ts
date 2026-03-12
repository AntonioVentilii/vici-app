import type { MarketIdSchema } from '$lib/schema/market.schema';
import type { Token } from '$lib/types/token';
import type { PrincipalText } from '@dfinity/zod-schemas';
import type * as z from 'zod';

export type MarketId = z.infer<typeof MarketIdSchema>;

export type MarketStatus = 'Open' | 'Expired' | 'Resolved';

export type Outcome = 'YES' | 'NO' | 'CANCELED' | string;

export interface Market {
	id: MarketId;
	title: string;
	description: string;
	creator: PrincipalText;
	expiryDate: bigint; // timestamp in ms
	status: MarketStatus;
	outcome?: Outcome;
	outcomes?: { id: string; title: string }[];
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
	token: Token;
	pricePrecision: number;
}
