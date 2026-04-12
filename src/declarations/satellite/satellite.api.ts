import type { IDL } from '@icp-sdk/core/candid';
import { getSatelliteExtendedActor } from '@junobuild/core';

export const idlFactory: IDL.InterfaceFactory = ({ IDL }) => {
	const UserRole = IDL.Variant({
		admin: IDL.Null,
		user: IDL.Null,
		controller: IDL.Null,
		solver: IDL.Null,
		creator: IDL.Null,
		moderator: IDL.Null,
		group_creator: IDL.Null
	});

	const UserProfile = IDL.Record({
		owner: IDL.Principal,
		nickname: IDL.Opt(IDL.Text),
		avatar: IDL.Opt(IDL.Text),
		pnl: IDL.Opt(IDL.Float64),
		visibility: IDL.Opt(IDL.Text),
		role: IDL.Opt(UserRole),
		totalTrades: IDL.Opt(IDL.Nat32),
		winRate: IDL.Opt(IDL.Float64),
		dailyStreak: IDL.Opt(IDL.Nat32),
		streak: IDL.Opt(IDL.Nat32),
		accuracy: IDL.Opt(IDL.Float64),
		points: IDL.Opt(IDL.Nat32),
		level: IDL.Opt(IDL.Nat32),
		interests: IDL.Opt(IDL.Vec(IDL.Text)),
		lastActiveDay: IDL.Opt(IDL.Text),
		createdAt: IDL.Opt(IDL.Nat64),
		updatedAt: IDL.Opt(IDL.Nat64)
	});

	const Relation = IDL.Record({
		category: IDL.Text,
		state: IDL.Text,
		participants: IDL.Vec(IDL.Text),
		metadata: IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
		createdAt: IDL.Nat64,
		updatedAt: IDL.Nat64
	});

	const ProfileList = IDL.Record({ items: IDL.Vec(UserProfile) });
	const RelationList = IDL.Record({ items: IDL.Vec(Relation) });

	return IDL.Service({
		listLeaderboard: IDL.Func([], [ProfileList], ['query']),
		getProfile: IDL.Func(
			[IDL.Record({ principal: IDL.Text })],
			[IDL.Record({ profile: IDL.Opt(UserProfile) })],
			['query']
		),
		listFriends: IDL.Func([], [RelationList], ['query']),
		listFollowers: IDL.Func([], [RelationList], ['query']),
		listFollowing: IDL.Func([], [RelationList], ['query']),
		checkFriendship: IDL.Func(
			[IDL.Record({ userA: IDL.Text, userB: IDL.Text })],
			[IDL.Record({ isFriend: IDL.Bool })],
			['query']
		),
		searchProfiles: IDL.Func([IDL.Record({ query: IDL.Text })], [ProfileList], ['query']),
		listFriendRequests: IDL.Func([], [RelationList], ['query']),
		listRejectedFriendships: IDL.Func([], [RelationList], ['query']),
		sendFriendRequest: IDL.Func([IDL.Record({ target: IDL.Text })], [], []),
		acceptFriendRequest: IDL.Func([IDL.Record({ relationId: IDL.Text })], [], []),
		rejectFriendRequest: IDL.Func([IDL.Record({ relationId: IDL.Text })], [], []),
		followUser: IDL.Func([IDL.Record({ target: IDL.Text })], [], [])
	});
};

export const functions = await getSatelliteExtendedActor({ idlFactory });
