import type { Market, Outcome } from '$lib/types/market';
import type { Position, PositionType } from '$lib/types/position';
import type { LeaderboardEntry } from '$lib/types/social';
import type { Transaction, WalletBalance } from '$lib/types/wallet';

/**
 * Backend Interface defining all methods needed for the frontend.
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
	 * Places a prediction on a market outcome.
	 */
	placePrediction(
		marketId: string,
		type: PositionType,
		amount: bigint,
		token: 'ICP' | 'ckUSDC'
	): Promise<void>;

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
	 * Fetches the leaderboard rankings.
	 */
	getLeaderboard(): Promise<LeaderboardEntry[]>;

	/**
	 * Fetches the user's friends list.
	 */
	getFriends(): Promise<string[]>;

	/**
	 * Fetches a queue of markets for "Rush Mode".
	 */
	getRushQueue(): Promise<Market[]>;
}
