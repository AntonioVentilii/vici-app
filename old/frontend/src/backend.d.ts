import type { Principal } from '@icp-sdk/core/principal';
export interface Some<T> {
	__kind__: 'Some';
	value: T;
}
export interface None {
	__kind__: 'None';
}
export type Option<T> = Some<T> | None;
export interface AnalyticsDataPoint {
	oddsNo: number;
	volume: bigint;
	timestamp: Time;
	oddsYes: number;
}
export interface MarketDepthPosition {
	nickname: string;
	odds: number;
	user: Principal;
	positionType: PositionType;
	amount: bigint;
}
export type Time = bigint;
export interface Position {
	odds: number;
	createdAt: Time;
	positionType: PositionType;
	marketId: bigint;
	amount: bigint;
}
export interface WalletBalance {
	icp: bigint;
	ckUSDC: bigint;
}
export interface MarketSnapshot {
	id: bigint;
	categories: Array<string>;
	status: MarketStatus;
	invitedUsers: Array<Principal>;
	title: string;
	oddsNo: number;
	resolvedOutcome?: boolean;
	createdAt: Time;
	createdBy: Principal;
	description: string;
	expiration: Time;
	inviteOnly: boolean;
	oddsYes: number;
}
export interface Comment {
	id: bigint;
	content: string;
	createdAt: Time;
	user: Principal;
	marketId: bigint;
	isHidden: boolean;
}
export interface UserProfile {
	nickname: string;
	balance: bigint;
	createdAt: Time;
	lastLogin: Time;
	avatar: string;
}
export interface Transaction {
	id: bigint;
	transactionType: Variant_trade_deposit_payout;
	odds?: number;
	createdAt: Time;
	user: Principal;
	positionType?: PositionType;
	marketId?: bigint;
	amount: bigint;
}
export enum MarketStatus {
	resolved = 'resolved',
	closed = 'closed',
	open = 'open'
}
export enum PositionType {
	no = 'no',
	yes = 'yes'
}
export enum UserRole {
	admin = 'admin',
	user = 'user',
	guest = 'guest'
}
export enum Variant_trade_deposit_payout {
	trade = 'trade',
	deposit = 'deposit',
	payout = 'payout'
}
export interface backendInterface {
	addComment(marketId: bigint, content: string): Promise<bigint>;
	addFriend(friend: Principal): Promise<void>;
	assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
	createMarket(
		title: string,
		description: string,
		categories: Array<string>,
		expiration: Time,
		inviteOnly: boolean,
		invitedUsers: Array<Principal>
	): Promise<bigint>;
	createUserProfile(nickname: string, avatar: string): Promise<void>;
	depositFunds(amount: bigint): Promise<void>;
	getAllMarkets(): Promise<Array<MarketSnapshot>>;
	getCallerUserProfile(): Promise<UserProfile | null>;
	getCallerUserRole(): Promise<UserRole>;
	getFriends(): Promise<Array<Principal>>;
	getFriendsPositions(): Promise<Array<[Principal, Array<Position>]>>;
	getMarket(marketId: bigint): Promise<MarketSnapshot | null>;
	getMarketAnalytics(marketId: bigint): Promise<Array<AnalyticsDataPoint>>;
	getMarketComments(marketId: bigint): Promise<Array<Comment>>;
	getMarketDepth(marketId: bigint): Promise<Array<MarketDepthPosition>>;
	getMarketsByCategory(category: string): Promise<Array<MarketSnapshot>>;
	getUserPositions(): Promise<Array<Position>>;
	getUserProfile(user: Principal): Promise<UserProfile | null>;
	getUserTransactions(): Promise<Array<Transaction>>;
	getWalletBalance(): Promise<WalletBalance | null>;
	hideComment(commentId: bigint, marketId: bigint): Promise<void>;
	initializeAccessControl(): Promise<void>;
	isCallerAdmin(): Promise<boolean>;
	placePosition(marketId: bigint, positionType: PositionType, amount: bigint): Promise<void>;
	removeFriend(friend: Principal): Promise<void>;
	resolveMarket(marketId: bigint, outcome: boolean): Promise<void>;
	saveCallerUserProfile(profile: UserProfile): Promise<void>;
	updateLastLogin(): Promise<void>;
	updateMarketAnalytics(marketId: bigint): Promise<void>;
	withdrawFunds(amount: bigint): Promise<void>;
	getAdminList(): Promise<Array<Principal>>;
	addAdmin(principal: Principal): Promise<void>;
	removeAdmin(principal: Principal): Promise<void>;
}
