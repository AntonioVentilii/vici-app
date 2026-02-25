import type { Principal } from '@dfinity/principal';

/**
 * Common types based on the Vici Social Markets specification.
 */

export type MarketStatus = 'Open' | 'Expired' | 'Resolved';
export type Outcome = 'YES' | 'NO' | 'CANCELED';
export type PositionType = 'YES' | 'NO';
export type TransactionType = 'Trade' | 'Send' | 'Receive';

export interface Market {
	id: string;
	title: string;
	description: string;
	creator: string; // Principal string representation
	expiryDate: number; // timestamp in ms
	status: MarketStatus;
	outcome?: Outcome;
	isInviteOnly: boolean;
	inviteList: string[];
	totalVolume: bigint;
	yesVolume: bigint;
	noVolume: bigint;
	yesProbability: number;
	noProbability: number;
}

export interface Position {
	marketId: string;
	user: string;
	yesAmount: bigint;
	noAmount: bigint;
}

export interface WalletBalance {
	icp: bigint;
	ckUSDC: bigint;
}

export interface Transaction {
	id: string;
	user: string;
	timestamp: number;
	type: TransactionType;
	marketId?: string;
	amount: bigint;
	token: 'ICP' | 'ckUSDC';
	counterparty?: string;
}

/**
 * Backend Interface defining all methods needed for the frontend.
 * These methods are mocked for now and will be connected to the canister later.
 */
export interface BackendInterface {
	/**
	 * Creates a new market. (Admin only in production)
	 */
	createMarket(
		title: string,
		description: string,
		expiryDate: number,
		isInviteOnly?: boolean
	): Promise<string>;

	/**
	 * Fetches all markets.
	 */
	getMarkets(): Promise<Market[]>;

	/**
	 * Fetches a single market by ID.
	 */
	getMarket(marketId: string): Promise<Market | null>;

	/**
	 * Resolves a market with a specific outcome. (Admin only in production)
	 */
	resolveMarket(marketId: string, outcome: Outcome): Promise<void>;

	/**
	 * Places a bet on a market outcome.
	 */
	placeBet(marketId: string, type: PositionType, amount: bigint, token: 'ICP' | 'ckUSDC'): Promise<void>;

	/**
	 * Returns the user's balances for ICP and ckUSDC.
	 */
	getBalances(): Promise<WalletBalance>;

	/**
	 * Sends ICP to another principal.
	 */
	sendICP(recipient: string, amount: bigint): Promise<void>;

	/**
	 * Sends ckUSDC to another principal.
	 */
	sendCkUSDC(recipient: string, amount: bigint): Promise<void>;

	/**
	 * Fetches transaction history for the current user.
	 */
	getTransactions(): Promise<Transaction[]>;

	/**
	 * Fetches the user's positions across all markets.
	 */
	getPositions(): Promise<Position[]>;

	/**
	 * Checks if the caller is an admin.
	 */
	isAdmin(): Promise<boolean>;

	/**
	 * Adds a friend by principal ID.
	 */
	addFriend(friendId: string): Promise<void>;

	/**
	 * Removes a friend.
	 */
	removeFriend(friendId: string): Promise<void>;

	/**
	 * Fetches the user's friends list.
	 */
	getFriends(): Promise<string[]>;

	/**
	 * Fetches a queue of markets for "Rush Mode".
	 */
	getRushQueue(): Promise<Market[]>;
}

/**
 * Mock implementation of the BackendInterface.
 */
class MockBackend implements BackendInterface {
	private markets: Market[] = [
		{
			id: '1',
			title: 'Will ICP reach $50 by the end of 2026?',
			description: 'This market predicts if the price of ICP will be at least $50 USD on Dec 31, 2026.',
			creator: 'aaaaa-aa',
			expiryDate: new Date('2026-12-31').getTime(),
			status: 'Open',
			isInviteOnly: false,
			inviteList: [],
			totalVolume: 1000000000n,
			yesVolume: 600000000n,
			noVolume: 400000000n,
			yesProbability: 0.6,
			noProbability: 0.4
		},
		{
			id: '2',
			title: 'Will Svelte 6 be released in 2026?',
			description: 'Bet on whether the next major version of Svelte will be officially released this year.',
			creator: 'aaaaa-aa',
			expiryDate: new Date('2026-12-31').getTime(),
			status: 'Open',
			isInviteOnly: false,
			inviteList: [],
			totalVolume: 500000000n,
			yesVolume: 250000000n,
			noVolume: 250000000n,
			yesProbability: 0.5,
			noProbability: 0.5
		}
	];

	private positions: Position[] = [];
	private transactions: Transaction[] = [];
	private balance: WalletBalance = { icp: 1000000000n, ckUSDC: 5000000000n };
	private friends: string[] = [];

	async createMarket(title: string, description: string, expiryDate: number, isInviteOnly = false): Promise<string> {
		const id = (this.markets.length + 1).toString();
		const newMarket: Market = {
			id,
			title,
			description,
			creator: 'current-user-principal',
			expiryDate,
			status: 'Open',
			isInviteOnly,
			inviteList: [],
			totalVolume: 0n,
			yesVolume: 0n,
			noVolume: 0n,
			yesProbability: 0.5,
			noProbability: 0.5
		};
		this.markets.push(newMarket);
		return id;
	}

	async getMarkets(): Promise<Market[]> {
		return this.markets;
	}

	async getMarket(marketId: string): Promise<Market | null> {
		return this.markets.find((m) => m.id === marketId) || null;
	}

	async resolveMarket(marketId: string, outcome: Outcome): Promise<void> {
		const market = this.markets.find((m) => m.id === marketId);
		if (market) {
			market.status = 'Resolved';
			market.outcome = outcome;
		}
	}

	async placeBet(marketId: string, type: PositionType, amount: bigint, token: 'ICP' | 'ckUSDC'): Promise<void> {
		const market = this.markets.find((m) => m.id === marketId);
		if (!market) throw new Error('Market not found');

		// Simple mock logic: update volumes and balance
		if (token === 'ICP') {
			if (this.balance.icp < amount) throw new Error('Insufficient ICP');
			this.balance.icp -= amount;
		} else {
			if (this.balance.ckUSDC < amount) throw new Error('Insufficient ckUSDC');
			this.balance.ckUSDC -= amount;
		}

		market.totalVolume += amount;
		if (type === 'YES') {
			market.yesVolume += amount;
		} else {
			market.noVolume += amount;
		}

		// Update probabilities (naive calculation)
		const total = Number(market.yesVolume + market.noVolume);
		market.yesProbability = Number(market.yesVolume) / total;
		market.noProbability = Number(market.noVolume) / total;

		this.transactions.push({
			id: Math.random().toString(36).substring(7),
			user: 'current-user',
			timestamp: Date.now(),
			type: 'Trade',
			marketId,
			amount,
			token
		});
	}

	async getBalances(): Promise<WalletBalance> {
		return this.balance;
	}

	async sendICP(recipient: string, amount: bigint): Promise<void> {
		if (this.balance.icp < amount) throw new Error('Insufficient ICP');
		this.balance.icp -= amount;
		this.transactions.push({
			id: Math.random().toString(36).substring(7),
			user: 'current-user',
			timestamp: Date.now(),
			type: 'Send',
			amount,
			token: 'ICP',
			counterparty: recipient
		});
	}

	async sendCkUSDC(recipient: string, amount: bigint): Promise<void> {
		if (this.balance.ckUSDC < amount) throw new Error('Insufficient ckUSDC');
		this.balance.ckUSDC -= amount;
		this.transactions.push({
			id: Math.random().toString(36).substring(7),
			user: 'current-user',
			timestamp: Date.now(),
			type: 'Send',
			amount,
			token: 'ckUSDC',
			counterparty: recipient
		});
	}

	async getTransactions(): Promise<Transaction[]> {
		return this.transactions;
	}

	async getPositions(): Promise<Position[]> {
		return this.positions;
	}

	async isAdmin(): Promise<boolean> {
		return true; // Mock: everyone is admin in this demo
	}

	async addFriend(friendId: string): Promise<void> {
		if (!this.friends.includes(friendId)) {
			this.friends.push(friendId);
		}
	}

	async removeFriend(friendId: string): Promise<void> {
		this.friends = this.friends.filter((f) => f !== friendId);
	}

	async getFriends(): Promise<string[]> {
		return this.friends;
	}

	async getRushQueue(): Promise<Market[]> {
		return this.markets.slice(0, 5); // Return first 5 markets for rush
	}
}

export const mockBackend = new MockBackend();
