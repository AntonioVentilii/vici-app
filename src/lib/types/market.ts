import type { MarketIdSchema } from '$lib/schema/market.schema';
import type { Principal } from '@icp-sdk/core/principal';
import type * as z from 'zod';

export type MarketId = z.infer<typeof MarketIdSchema>;

export type MarketStatus = 'Open' | 'Expired' | 'Resolved';

export type Outcome = 'YES' | 'NO' | 'CANCELED';

export interface Market {
	id: MarketId;
	title: string;
	description: string;
	creator: Principal;
	expiryDate: bigint; // timestamp in ms
	status: MarketStatus;
	outcome?: Outcome;
	isInviteOnly: boolean;
	inviteList: Principal[];
	totalVolume: bigint;
	yesVolume: bigint;
	noVolume: bigint;
	yesProbability: number;
	noProbability: number;
}

// TODO: do we need this???
export interface MarketMetadata {
	id: MarketId;
	creator: Principal;
	totalVolume: bigint;
	yesVolume: bigint;
	noVolume: bigint;
	yesProbability: number;
	noProbability: number;
	status: MarketStatus;
	outcome?: Outcome;
}
