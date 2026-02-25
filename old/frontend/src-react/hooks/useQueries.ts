import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import type {
	MarketSnapshot,
	Position,
	Transaction,
	UserProfile,
	PositionType,
	UserRole,
	MarketDepthPosition,
	AnalyticsDataPoint,
	Comment,
	WalletBalance
} from '../backend';
import { Principal } from '@icp-sdk/core/principal';
import { toast } from 'sonner';

// User Profile Queries
export function useGetCallerUserProfile() {
	const { actor, isFetching: actorFetching } = useActor();

	const query = useQuery<UserProfile | null>({
		queryKey: ['currentUserProfile'],
		queryFn: async () => {
			if (!actor) throw new Error('Actor not available');
			return actor.getCallerUserProfile();
		},
		enabled: !!actor && !actorFetching,
		retry: false
	});

	return {
		...query,
		isLoading: actorFetching || query.isLoading,
		isFetched: !!actor && query.isFetched
	};
}

export function useGetUserProfile(user: Principal | null) {
	const { actor, isFetching } = useActor();

	return useQuery<UserProfile | null>({
		queryKey: ['userProfile', user?.toString()],
		queryFn: async () => {
			if (!actor || !user) return null;
			return actor.getUserProfile(user);
		},
		enabled: !!actor && !isFetching && !!user
	});
}

export function useIsCallerAdmin() {
	const { actor, isFetching } = useActor();
	const { identity } = useInternetIdentity();

	return useQuery<boolean>({
		queryKey: ['isAdmin', identity?.getPrincipal().toString()],
		queryFn: async () => {
			if (!actor) return false;
			return actor.isCallerAdmin();
		},
		enabled: !!actor && !isFetching && !!identity
	});
}

export function useCreateUserProfile() {
	const { actor } = useActor();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ nickname, avatar }: { nickname: string; avatar: string }) => {
			if (!actor) throw new Error('Actor not available');
			return actor.createUserProfile(nickname, avatar);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
		}
	});
}

// Alias for backward compatibility
export const useInitializeUser = useCreateUserProfile;

export function useSaveCallerUserProfile() {
	const { actor } = useActor();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (profile: UserProfile) => {
			if (!actor) throw new Error('Actor not available');
			return actor.saveCallerUserProfile(profile);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
		}
	});
}

// Friends Management
export function useGetFriendsList() {
	const { actor, isFetching } = useActor();
	const { identity } = useInternetIdentity();

	return useQuery<Principal[]>({
		queryKey: ['friendsList', identity?.getPrincipal().toString()],
		queryFn: async () => {
			if (!actor || !identity) return [];
			return actor.getFriends();
		},
		enabled: !!actor && !isFetching && !!identity
	});
}

export function useAddFriend() {
	const { actor } = useActor();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (friend: Principal) => {
			if (!actor) throw new Error('Actor not available');
			return actor.addFriend(friend);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['friendsList'] });
		}
	});
}

export function useRemoveFriend() {
	const { actor } = useActor();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (friend: Principal) => {
			if (!actor) throw new Error('Actor not available');
			return actor.removeFriend(friend);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['friendsList'] });
		}
	});
}

// Market Queries
export function useGetAllMarkets() {
	const { actor, isFetching } = useActor();

	return useQuery<MarketSnapshot[]>({
		queryKey: ['markets'],
		queryFn: async () => {
			if (!actor) return [];
			return actor.getAllMarkets();
		},
		enabled: !!actor && !isFetching
	});
}

export function useGetMarket(marketId: bigint | null) {
	const { actor, isFetching } = useActor();

	return useQuery<MarketSnapshot | null>({
		queryKey: ['market', marketId?.toString()],
		queryFn: async () => {
			if (!actor || !marketId) return null;
			return actor.getMarket(marketId);
		},
		enabled: !!actor && !isFetching && marketId !== null
	});
}

export function useCreateMarket() {
	const { actor } = useActor();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			title,
			description,
			categories,
			expiration,
			inviteOnly,
			invitedUsers
		}: {
			title: string;
			description: string;
			categories: string[];
			expiration: bigint;
			inviteOnly: boolean;
			invitedUsers?: Principal[];
		}) => {
			if (!actor) throw new Error('Actor not available');
			return actor.createMarket(
				title,
				description,
				categories,
				expiration,
				inviteOnly,
				invitedUsers || []
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['markets'] });
		}
	});
}

export function useResolveMarket() {
	const { actor } = useActor();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ marketId, outcome }: { marketId: bigint; outcome: boolean }) => {
			if (!actor) throw new Error('Actor not available');
			return actor.resolveMarket(marketId, outcome);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['markets'] });
			queryClient.invalidateQueries({ queryKey: ['positions'] });
			queryClient.invalidateQueries({ queryKey: ['transactions'] });
			queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
		}
	});
}

// Market Invitations (placeholder - not in backend)
export function useGetInvitedUsers(marketId: bigint | null) {
	const { actor, isFetching } = useActor();

	return useQuery<Principal[]>({
		queryKey: ['invitedUsers', marketId?.toString()],
		queryFn: async () => {
			if (!actor || !marketId) return [];
			// Backend method not available - return invited users from market snapshot
			const market = await actor.getMarket(marketId);
			return market?.invitedUsers || [];
		},
		enabled: !!actor && !isFetching && marketId !== null
	});
}

export function useInviteUsers() {
	const { actor } = useActor();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ marketId, users }: { marketId: bigint; users: Principal[] }) => {
			if (!actor) throw new Error('Actor not available');
			// Backend method not available yet
			throw new Error('Invite users functionality not yet implemented in backend');
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ['invitedUsers', variables.marketId.toString()] });
			queryClient.invalidateQueries({ queryKey: ['market', variables.marketId.toString()] });
		}
	});
}

// Trading
export function usePlaceTrade() {
	const { actor } = useActor();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			marketId,
			positionType,
			amount
		}: {
			marketId: bigint;
			positionType: PositionType;
			amount: bigint;
		}) => {
			if (!actor) throw new Error('Actor not available');
			return actor.placePosition(marketId, positionType, amount);
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
			queryClient.invalidateQueries({ queryKey: ['positions'] });
			queryClient.invalidateQueries({ queryKey: ['transactions'] });
			queryClient.invalidateQueries({ queryKey: ['marketDepth', variables.marketId.toString()] });
			queryClient.invalidateQueries({
				queryKey: ['marketAnalytics', variables.marketId.toString()]
			});
			queryClient.invalidateQueries({ queryKey: ['rushQueue'] });
		}
	});
}

// Portfolio
export function useGetCallerPositions() {
	const { actor, isFetching } = useActor();

	return useQuery<Position[]>({
		queryKey: ['positions'],
		queryFn: async () => {
			if (!actor) return [];
			return actor.getUserPositions();
		},
		enabled: !!actor && !isFetching
	});
}

export function useGetCallerTransactions() {
	const { actor, isFetching } = useActor();

	return useQuery<Transaction[]>({
		queryKey: ['transactions'],
		queryFn: async () => {
			if (!actor) return [];
			return actor.getUserTransactions();
		},
		enabled: !!actor && !isFetching
	});
}

// Market Depth
export function useGetMarketDepth(marketId: bigint | null) {
	const { actor, isFetching } = useActor();

	return useQuery<MarketDepthPosition[]>({
		queryKey: ['marketDepth', marketId?.toString()],
		queryFn: async () => {
			if (!actor || !marketId) return [];
			return actor.getMarketDepth(marketId);
		},
		enabled: !!actor && !isFetching && marketId !== null
	});
}

// Market Analytics
export function useGetMarketAnalytics(marketId: bigint | null) {
	const { actor, isFetching } = useActor();

	return useQuery<AnalyticsDataPoint[]>({
		queryKey: ['marketAnalytics', marketId?.toString()],
		queryFn: async () => {
			if (!actor || !marketId) return [];
			return actor.getMarketAnalytics(marketId);
		},
		enabled: !!actor && !isFetching && marketId !== null
	});
}

// Comments
export function useGetMarketComments(marketId: bigint | null) {
	const { actor, isFetching } = useActor();

	return useQuery<Comment[]>({
		queryKey: ['comments', marketId?.toString()],
		queryFn: async () => {
			if (!actor || !marketId) return [];
			return actor.getMarketComments(marketId);
		},
		enabled: !!actor && !isFetching && marketId !== null
	});
}

export function useCreateComment() {
	const { actor } = useActor();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ marketId, content }: { marketId: bigint; content: string }) => {
			if (!actor) throw new Error('Actor not available');
			return actor.addComment(marketId, content);
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ['comments', variables.marketId.toString()] });
		}
	});
}

export function useModerateComment() {
	const { actor } = useActor();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ marketId, commentId }: { marketId: bigint; commentId: bigint }) => {
			if (!actor) throw new Error('Actor not available');
			// Backend hideComment only hides, doesn't toggle
			return actor.hideComment(commentId, marketId);
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ['comments', variables.marketId.toString()] });
		}
	});
}

// Admin - Grant Coins (placeholder - backend method not available)
export function useGrantViciCoins() {
	const { actor } = useActor();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ user, amount }: { user: Principal; amount: bigint }) => {
			if (!actor) throw new Error('Actor not available');
			// Backend method not available - this is a placeholder
			throw new Error('Grant coins functionality not yet implemented in backend');
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['userProfile'] });
		}
	});
}

// Admin Management (placeholder - backend methods not available)
export function useAdminList() {
	const { actor, isFetching } = useActor();

	return useQuery<Principal[]>({
		queryKey: ['adminList'],
		queryFn: async () => {
			if (!actor) return [];
			// Backend method not available yet
			if ('getAdminList' in actor && typeof actor.getAdminList === 'function') {
				return actor.getAdminList();
			}
			return [];
		},
		enabled: !!actor && !isFetching
	});
}

export function useAddAdmin() {
	const { actor } = useActor();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (principal: Principal) => {
			if (!actor) throw new Error('Actor not available');
			// Backend method not available yet
			if ('addAdmin' in actor && typeof actor.addAdmin === 'function') {
				return actor.addAdmin(principal);
			}
			throw new Error('Add admin functionality not yet implemented in backend');
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['adminList'] });
			toast.success('Admin added successfully');
		},
		onError: (error: any) => {
			toast.error(error.message || 'Failed to add admin');
		}
	});
}

export function useRemoveAdmin() {
	const { actor } = useActor();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (principal: Principal) => {
			if (!actor) throw new Error('Actor not available');
			// Backend method not available yet
			if ('removeAdmin' in actor && typeof actor.removeAdmin === 'function') {
				return actor.removeAdmin(principal);
			}
			throw new Error('Remove admin functionality not yet implemented in backend');
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['adminList'] });
			toast.success('Admin removed successfully');
		},
		onError: (error: any) => {
			toast.error(error.message || 'Failed to remove admin');
		}
	});
}

// Leaderboard (placeholder - backend method not available)
export function useGetLeaderboard(limit: number = 10) {
	const { actor, isFetching } = useActor();

	return useQuery<[Principal, bigint][]>({
		queryKey: ['leaderboard', limit],
		queryFn: async () => {
			if (!actor) return [];
			// Backend method not available yet
			if ('getLeaderboard' in actor && typeof actor.getLeaderboard === 'function') {
				return actor.getLeaderboard(BigInt(limit));
			}
			return [];
		},
		enabled: !!actor && !isFetching
	});
}

// Rush Mode (placeholder - backend method not available)
export function useGetRushQueue(limit: number = 10) {
	const { actor, isFetching } = useActor();

	return useQuery<MarketSnapshot[]>({
		queryKey: ['rushQueue', limit],
		queryFn: async () => {
			if (!actor) return [];
			// Backend method not available - return open markets as fallback
			const markets = await actor.getAllMarkets();
			return markets.filter((m) => m.status === 'open').slice(0, limit);
		},
		enabled: !!actor && !isFetching
	});
}

// Wallet Management
export function useGetWalletBalance() {
	const { actor, isFetching } = useActor();
	const { identity } = useInternetIdentity();

	return useQuery<WalletBalance | null>({
		queryKey: ['walletBalance', identity?.getPrincipal().toString()],
		queryFn: async () => {
			if (!actor || !identity) return null;
			return actor.getWalletBalance();
		},
		enabled: !!actor && !isFetching && !!identity
	});
}

export function useUpdateWalletBalance() {
	const { actor } = useActor();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ icp, ckUSDC }: { icp: bigint; ckUSDC: bigint }) => {
			if (!actor) throw new Error('Actor not available');
			// This would need to be implemented via deposit/withdraw in the backend
			throw new Error('Direct wallet balance update not available - use deposit/withdraw methods');
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
		}
	});
}

export function useDepositFunds() {
	const { actor } = useActor();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (amount: bigint) => {
			if (!actor) throw new Error('Actor not available');
			return actor.depositFunds(amount);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
			queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
		}
	});
}

export function useWithdrawFunds() {
	const { actor } = useActor();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (amount: bigint) => {
			if (!actor) throw new Error('Actor not available');
			return actor.withdrawFunds(amount);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
			queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
		}
	});
}
