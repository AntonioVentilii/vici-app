import type { ProfileVisibility } from '$lib/enums/profile';
import type { UserRole } from '$lib/enums/user';
import type { TrackEventInput } from '$lib/types/analytics-event';
import type { UserProfile } from '$lib/types/profile';
import type { FriendRequestOutcome, Relation } from '$lib/types/relation';
import type { ResolvedResult } from '$lib/types/social';
import type { UserStatsDoc } from '$lib/types/user-stats';
import { web2ApiBaseUrl } from '$lib/web2/backend-mode';
import { isNullish, nonNullish } from '@dfinity/utils';

/**
 * Thin typed fetch client for the HTTP API (`/api/v1/...`).
 *
 * Sessions ride an HttpOnly cookie, so every request opts in to
 * credentials; the client itself holds no auth state. Error responses use
 * a stable `{ error: string }` envelope, surfaced as {@link Web2ApiError}
 * so callers can branch on `status` / `code` without parsing bodies.
 *
 * Add a typed wrapper here per endpoint a dual-mode service needs; keep
 * the wrappers thin (shape mapping only, no orchestration).
 */

export class Web2ApiError extends Error {
	readonly status: number;
	/** Stable machine-readable code from the `{ error }` envelope. */
	readonly code: string;

	constructor({ status, code }: { status: number; code: string }) {
		super(`Web2 API error (${status}): ${code}`);

		this.status = status;
		this.code = code;
	}
}

const errorCode = async (response: Response): Promise<string> => {
	try {
		const payload: unknown = await response.json();

		if (
			!isNullish(payload) &&
			typeof payload === 'object' &&
			'error' in payload &&
			typeof payload.error === 'string'
		) {
			return payload.error;
		}
	} catch {
		// Non-JSON error body (proxy error page, empty 502); the generic code below applies.
	}

	return 'unknown_error';
};

const request = async <T>({
	path,
	method,
	body
}: {
	path: string;
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	body?: Record<string, unknown>;
}): Promise<T> => {
	const response = await fetch(`${web2ApiBaseUrl()}${path}`, {
		method,
		credentials: 'include',
		...(isNullish(body)
			? {}
			: {
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(body)
				})
	});

	if (!response.ok) {
		throw new Web2ApiError({ status: response.status, code: await errorCode(response) });
	}

	return (await response.json()) as T;
};

export type Web2ProviderStatus = 'available' | 'coming_soon';

export interface Web2Providers {
	email: Web2ProviderStatus;
	google: Web2ProviderStatus;
	apple: Web2ProviderStatus;
}

export interface Web2Identity {
	provider: string;
	email: string | null;
}

export interface Web2LegacyPrincipal {
	principal: string;
	matchedVia: string;
}

export interface Web2Me {
	id: string;
	role: string;
	displayName: string | null;
	avatarUrl: string | null;
	createdAt: string;
	identities: Web2Identity[];
	legacyPrincipals: Web2LegacyPrincipal[];
}

export const getProviders = async (): Promise<Web2Providers> => {
	const { providers } = await request<{ providers: Web2Providers }>({
		path: '/api/v1/auth/providers',
		method: 'GET'
	});

	return providers;
};

export const getMe = async (): Promise<Web2Me> => {
	const { user } = await request<{ user: Web2Me }>({ path: '/api/v1/me', method: 'GET' });

	return user;
};

/**
 * Ask the API to email a one-time code to `email`. Resolves on a queued
 * send; a 4xx (unknown/invalid address, rate limit) surfaces as
 * {@link Web2ApiError} so the caller can message the user.
 */
export const requestOtp = async ({ email }: { email: string }): Promise<void> => {
	await request<{ ok: boolean }>({
		path: '/api/v1/auth/otp/request',
		method: 'POST',
		body: { email }
	});
};

/**
 * Exchange an emailed code for a session. The API sets the HttpOnly session
 * cookie on the response and echoes the `/me` body, so the returned user can
 * seed the session store without a second round-trip. A wrong or expired
 * code throws {@link Web2ApiError} (`status` 401), a locked address 429.
 */
export const verifyOtp = async ({
	email,
	code
}: {
	email: string;
	code: string;
}): Promise<Web2Me> => {
	const { user } = await request<{ user: Web2Me }>({
		path: '/api/v1/auth/otp/verify',
		method: 'POST',
		body: { email, code }
	});

	return user;
};

/**
 * Absolute URL of the Google sign-in entry. It is a full-page redirect
 * target (the API sets a signed state cookie and 302s on to Google), not a
 * fetch, so callers navigate to it. `returnTo` rides along as the post-login
 * landing hint the API honors after its callback.
 */
export const googleSignInUrl = ({ returnTo }: { returnTo?: string } = {}): string => {
	const url = `${web2ApiBaseUrl()}/api/v1/auth/google`;

	if (isNullish(returnTo) || returnTo === '') {
		return url;
	}

	return `${url}?returnTo=${encodeURIComponent(returnTo)}`;
};

export const postEvents = async ({
	events
}: {
	events: TrackEventInput[];
}): Promise<{ accepted: number }> =>
	await request<{ accepted: number }>({
		path: '/api/v1/events',
		method: 'POST',
		body: { events }
	});

export const logout = async (): Promise<void> => {
	await request<{ ok: boolean }>({ path: '/api/v1/auth/logout', method: 'POST' });
};

// ─── Profiles + social + leaderboard ─────────────────────────────────────
//
// The HTTP API keys a user by an opaque `userId` (uuid) where the on-chain
// stack keys by a principal. The app's domain shape (`UserProfile`, `Relation`,
// `ResolvedResult`) uses the single `owner` string for that identity, so the
// wrappers below carry the wire→app rename (`userId` → `owner`) and re-narrow
// the loose wire string unions back to the app enums, keeping the return shapes
// byte-identical to the satellite services. A dual-mode service calls one of
// these behind `isWeb2Backend()`; the default on-chain path is untouched.

const encodeQuery = (params: Record<string, string>): string =>
	Object.entries(params)
		.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
		.join('&');

/** Wire profile: the app profile with `owner` carried as `userId`. */
type Web2ProfileWire = Omit<UserProfile, 'owner' | 'visibility' | 'role'> & {
	userId: string;
	visibility: string;
	role?: string;
};

const mapProfile = (wire: Web2ProfileWire): UserProfile => {
	const { userId, visibility, role, ...rest } = wire;

	return {
		...rest,
		owner: userId,
		visibility: visibility as ProfileVisibility,
		...(nonNullish(role) ? { role: role as UserRole } : {})
	};
};

/** Wire relation: `{ key, category, state, participants }`. The app `Relation`
 * drops the key (callers rebuild it from the participants when they need it). */
interface Web2RelationWire {
	key: string;
	category: Relation['category'];
	state: Relation['state'];
	participants: [string, string];
}

const mapRelation = (wire: Web2RelationWire): Relation => ({
	category: wire.category,
	state: wire.state,
	participants: wire.participants
});

interface Web2UserStatsWire {
	userId: string;
	categoryStats: UserStatsDoc['categoryStats'];
	recentSettlements: UserStatsDoc['recentSettlements'];
	computedAtMs: number;
}

interface Web2ResolvedResultWire {
	userId: string;
	marketId: string;
	title: string;
	side: string;
	outcome: 'win' | 'loss';
	netVxp: number;
	resolvedAtMs: number;
}

/** The caller's own profile, or `undefined` before the first profile write. */
export const getMyProfile = async (): Promise<UserProfile | undefined> => {
	const { profile } = await request<{ profile: Web2ProfileWire | null }>({
		path: '/api/v1/profiles/me',
		method: 'GET'
	});

	return isNullish(profile) ? undefined : mapProfile(profile);
};

/** A public profile by id, or `undefined` when absent / hidden to the caller. */
export const getProfileById = async (userId: string): Promise<UserProfile | undefined> => {
	const { profile } = await request<{ profile: Web2ProfileWire | null }>({
		path: `/api/v1/profiles/${encodeURIComponent(userId)}`,
		method: 'GET'
	});

	return isNullish(profile) ? undefined : mapProfile(profile);
};

/** Full-doc write of the caller's own profile; returns the stored result. */
export const upsertMyProfile = async (data: Record<string, unknown>): Promise<UserProfile> => {
	const { profile } = await request<{ profile: Web2ProfileWire }>({
		path: '/api/v1/profiles/me',
		method: 'PUT',
		body: data
	});

	return mapProfile(profile);
};

/** Server-side nickname validity + uniqueness probe. The caller's own current
 * nickname never counts as a conflict (the session identifies the caller). */
export const checkNicknameAvailability = async (
	nickname: string
): Promise<
	| { available: true }
	| { available: false; reason: 'required' | 'too_short' | 'too_long' | 'invalid' | 'taken' }
> =>
	await request({
		path: `/api/v1/profiles/nickname-availability?${encodeQuery({ nickname })}`,
		method: 'GET'
	});

/** Case-insensitive search over nickname, id, and linked legacy principal. */
export const searchProfiles = async (queryStr: string): Promise<UserProfile[]> => {
	const { items } = await request<{ items: Web2ProfileWire[] }>({
		path: `/api/v1/profiles/search?${encodeQuery({ q: queryStr })}`,
		method: 'GET'
	});

	return items.map(mapProfile);
};

/** Whether two users hold an active friendship. */
export const checkFriendship = async ({
	userA,
	userB
}: {
	userA: string;
	userB: string;
}): Promise<boolean> => {
	const { isFriend } = await request<{ isFriend: boolean }>({
		path: `/api/v1/social/friendship?${encodeQuery({ userA, userB })}`,
		method: 'GET'
	});

	return isFriend;
};

/** The caller's dashboard stat cache, or `undefined` before the first sync. */
export const getUserStats = async (): Promise<UserStatsDoc | undefined> => {
	const { stats } = await request<{ stats: Web2UserStatsWire | null }>({
		path: '/api/v1/profiles/me/stats',
		method: 'GET'
	});

	if (isNullish(stats)) {
		return;
	}

	const { userId, ...rest } = stats;

	return { owner: userId, ...rest };
};

/** Record one committed Flow swipe against the server-authoritative daily
 * counter; the server owns the count and the cap. */
export const recordFlowSwipe = async ({
	dayKey
}: {
	dayKey: string;
}): Promise<{ dailyGoalDone: number; dailyGoalDate: string; capReached: boolean }> =>
	await request({
		path: '/api/v1/profiles/flow-swipe',
		method: 'POST',
		body: { dayKey }
	});

/** Top profiles by points, ranked server-side. */
export const listLeaderboard = async (): Promise<UserProfile[]> => {
	const { items } = await request<{ items: Web2ProfileWire[] }>({
		path: '/api/v1/leaderboard/',
		method: 'GET'
	});

	return items.map(mapProfile);
};

/** The caller's rival across the full ranking, or `undefined` when unranked /
 * the lone ranked profile. `rivalIsTrailing` frames the gap as a lead. */
export const getMyRival = async (): Promise<
	{ profile: UserProfile; isTrailing: boolean } | undefined
> => {
	const { rival, rivalIsTrailing } = await request<{
		rival: Web2ProfileWire | null;
		rivalIsTrailing: boolean;
	}>({ path: '/api/v1/leaderboard/rival', method: 'GET' });

	return isNullish(rival) ? undefined : { profile: mapProfile(rival), isTrailing: rivalIsTrailing };
};

const listRelations = async (path: string): Promise<Relation[]> => {
	const { items } = await request<{ items: Web2RelationWire[] }>({ path, method: 'GET' });

	return items.map(mapRelation);
};

export const listFriends = (): Promise<Relation[]> => listRelations('/api/v1/social/friends');

export const listFollowers = (): Promise<Relation[]> => listRelations('/api/v1/social/followers');

export const listFollowing = (): Promise<Relation[]> => listRelations('/api/v1/social/following');

export const listFriendRequests = (): Promise<Relation[]> =>
	listRelations('/api/v1/social/friend-requests');

export const listSentFriendRequests = (): Promise<Relation[]> =>
	listRelations('/api/v1/social/friend-requests/sent');

export const sendFriendRequest = async (target: string): Promise<FriendRequestOutcome> =>
	await request({ path: '/api/v1/social/friend-requests', method: 'POST', body: { target } });

export const acceptFriendRequest = async (relationId: string): Promise<void> => {
	await request<{ ok: boolean }>({
		path: `/api/v1/social/friend-requests/${encodeURIComponent(relationId)}/accept`,
		method: 'POST'
	});
};

export const rejectFriendRequest = async (relationId: string): Promise<void> => {
	await request<{ ok: boolean }>({
		path: `/api/v1/social/friend-requests/${encodeURIComponent(relationId)}/reject`,
		method: 'POST'
	});
};

export const cancelFriendRequest = async (relationId: string): Promise<void> => {
	await request<{ ok: boolean }>({
		path: `/api/v1/social/friend-requests/${encodeURIComponent(relationId)}`,
		method: 'DELETE'
	});
};

export const unfriendUser = async (userId: string): Promise<void> => {
	await request<{ ok: boolean }>({
		path: `/api/v1/social/friends/${encodeURIComponent(userId)}`,
		method: 'DELETE'
	});
};

export const followUser = async (target: string): Promise<void> => {
	await request<{ ok: boolean }>({
		path: '/api/v1/social/follow',
		method: 'POST',
		body: { target }
	});
};

export const unfollowUser = async (userId: string): Promise<void> => {
	await request<{ ok: boolean }>({
		path: `/api/v1/social/follow/${encodeURIComponent(userId)}`,
		method: 'DELETE'
	});
};

/** Friend-scoped resolved-result rows for the Arena results digest. */
export const listFriendResolvedResults = async (friends: string[]): Promise<ResolvedResult[]> => {
	if (friends.length === 0) {
		return [];
	}

	const { items } = await request<{ items: Web2ResolvedResultWire[] }>({
		path: `/api/v1/social/resolved-results?${encodeQuery({ friends: friends.join(',') })}`,
		method: 'GET'
	});

	return items.map(({ userId, ...rest }) => ({ owner: userId, ...rest }));
};
