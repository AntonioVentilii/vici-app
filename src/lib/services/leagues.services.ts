import { functions } from '$declarations/satellite/satellite.api';
import { Collection } from '$lib/constants/collections.constants';
import { REFERRAL_CODE_REGEX } from '$lib/constants/referral.constants';
import { LeaguePrivacy } from '$lib/enums/league';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import { getMyReferralCode } from '$lib/services/referral.services';
import { leagueDirectoryStore } from '$lib/stores/league-directory.store';
import {
	BATTLE_TRASH_TALK_MAX_LENGTH,
	BATTLE_WAGER_MAX,
	BATTLE_WAGER_MIN,
	isBattleScope,
	type BattleDoc,
	type BattleScope
} from '$lib/types/battle';
import {
	LEAGUE_DESCRIPTION_MAX_LENGTH,
	LEAGUE_INVITE_CODE_REGEX,
	LEAGUE_NAME_MAX_LENGTH,
	LEAGUE_NAME_MIN_LENGTH,
	type LeagueDoc
} from '$lib/types/league';
import {
	leagueMemberKey,
	type LeagueMemberDoc,
	type LeagueMemberRole
} from '$lib/types/league-member';
import { nonNullish } from '@dfinity/utils';
import { deleteDoc, getDoc, setDoc } from '@junobuild/core';
import { get } from 'svelte/store';

/**
 * Thin service layer wrapping the satellite's social-cohort
 * endpoints. UI screens import the camelCase domain types from
 * here so they never have to touch the generated wire schemas
 * from `juno functions build`.
 *
 * Writes go through `@junobuild/core`'s `setDoc` / `deleteDoc`;
 * reads go through the typed `functions.*` client. Both paths are
 * gated server-side by the asserts shipped in
 * through BE-5.
 */

/** League hydrated with the caller's membership role. */
export interface LeagueWithRole {
	league: LeagueDoc;
	role: LeagueMemberRole;
	joinedAtMs: number;
	/** Total members in the league (owner included). */
	memberCount: number;
}

// ─── Reads ───────────────────────────────────────────────────────────────

/** Project the satellite's camelCase wire league to the FE `LeagueDoc`. */
const projectLeagueWire = (league: {
	id: string;
	name: string;
	description?: string;
	inviteCode: string;
	owner: string;
	createdAtMs: number;
	accentColor?: string;
	emblem?: string;
	// The generated wire client surfaces the Candid variant as a plain
	// string union; coerce it back to the `LeaguePrivacy` enum below (the
	// runtime values are identical).
	privacy: `${LeaguePrivacy}`;
	imageUrl?: string;
}): LeagueDoc => ({
	id: league.id,
	name: league.name,
	description: league.description,
	inviteCode: league.inviteCode,
	owner: league.owner,
	createdAtMs: league.createdAtMs,
	accentColor: league.accentColor,
	emblem: league.emblem,
	privacy: league.privacy as LeaguePrivacy,
	imageUrl: league.imageUrl
});

/**
 * List every league the caller is a member of, paired with their
 * role. Sorted newest-join first per the satellite query.
 */
export const listMyLeagues = async (): Promise<LeagueWithRole[]> => {
	const { items } = await functions.listMyLeagues();

	return items.map(({ league, role, joinedAtMs, memberCount }) => ({
		league: projectLeagueWire(league),
		role,
		joinedAtMs,
		memberCount
	}));
};

/**
 * Retroactively back-pay the "Founder +100 VXP" reward for any league the
 * caller owns that predates the founder-award hook. New leagues are paid
 * by the satellite hook on creation; this self-heal endpoint covers the
 * backlog and is idempotent (it shares the hook's dedupe key, so a league
 * already paid is never double-credited).
 *
 * Returns how many rewards were newly settled this call, so the Leagues
 * screen can surface a one-off beat. Best-effort: a transport error
 * resolves to `0` rather than rejecting, so it can never break the page
 * load it rides along with.
 */
export const settleFounderAwards = async (): Promise<number> => {
	try {
		const { settled } = await functions.settleFounderAwards();

		return settled;
	} catch {
		return 0;
	}
};

/**
 * List the leagues the caller can challenge to a battle — the opponent
 * pool for the create-battle picker. Publicly listed (Open) leagues plus
 * the caller's own memberships, minus leagues the caller owns. Sorted
 * alphabetically by name per the satellite query.
 */
export const listChallengeableLeagues = async (): Promise<LeagueDoc[]> => {
	const { items } = await functions.listChallengeableLeagues();

	return items.map(projectLeagueWire);
};

/**
 * A non-private (Open or Invite-only) league a friend is in but the
 * caller is not, plus the overlap.
 */
export interface FriendRecommendedLeague {
	league: LeagueDoc;
	/** Total members in the league (owner included). */
	memberCount: number;
	/** Principals of the caller's friends who are members of this league. */
	friendMembers: string[];
}

/**
 * List Open and Invite-only leagues the caller's confirmed friends are in
 * but the caller is not — the "Friends are in" recommendations row at the
 * foot of the Leagues list. Private leagues are never surfaced. Sorted by
 * friend-overlap count descending per the satellite query.
 */
export const listFriendRecommendedLeagues = async (): Promise<FriendRecommendedLeague[]> => {
	const { items } = await functions.listFriendRecommendedLeagues();

	return items.map(({ league, memberCount, friendMembers }) => ({
		league: projectLeagueWire(league),
		memberCount,
		friendMembers
	}));
};

/**
 * List the full member roster of a league, projected to the
 * camelCase `LeagueMemberDoc` the FE uses everywhere. Powers the
 * transfer-ownership picker (in the league detail surface and the
 * delete-account flow) where the caller needs the other members to
 * hand a league off to.
 */
export const listLeagueMembers = async ({
	leagueId
}: {
	leagueId: string;
}): Promise<LeagueMemberDoc[]> => {
	const { items } = await functions.listLeagueMembers({ leagueId });

	return items.map(({ leagueId, member, joinedAtMs, role }) => ({
		leagueId,
		member,
		joinedAtMs,
		role
	}));
};

/**
 * Resolve a 6-char invite code to its league, or `undefined` if no
 * league carries that code. Callers should treat the undefined
 * branch as "invalid code" UX, not an error.
 */
export const lookupLeagueByInvite = async ({
	inviteCode
}: {
	inviteCode: string;
}): Promise<LeagueDoc | undefined> => {
	const { league } = await functions.lookupLeagueByInvite({ inviteCode });

	if (!league) {
		return;
	}

	return projectLeagueWire(league);
};

/**
 * Read a league by id from the public `leagues` collection, or
 * `undefined` if none exists. Reads the datastore doc directly (it's
 * stored as a `LeagueDoc`, so no wire projection) rather than via a
 * typed query like `lookupLeagueByInvite`.
 */
export const getLeagueById = async ({ id }: { id: string }): Promise<LeagueDoc | undefined> => {
	const existing = await getDoc<LeagueDoc>({
		collection: Collection.LEAGUES,
		key: id
	});

	return existing?.data;
};

/**
 * Hydrate `leagueDirectoryStore` for any uncached ids — call it from any
 * surface that names a counterpart league. Mirrors
 * `loadProfilesByPrincipals`: per-id failures are swallowed (UI falls
 * back to a shortened id) and fetches run in bounded batches so a large
 * caller can't saturate the browser's connection pool.
 */
const LEAGUE_HYDRATION_CONCURRENCY = 25;

export const loadLeaguesByIds = async ({ ids }: { ids: string[] }): Promise<void> => {
	const cached = get(leagueDirectoryStore);
	const unique = Array.from(new Set(ids)).filter((id) => id.length > 0 && !cached.has(id));

	if (unique.length === 0) {
		return;
	}

	const docs: (LeagueDoc | undefined)[] = [];

	for (let start = 0; start < unique.length; start += LEAGUE_HYDRATION_CONCURRENCY) {
		const batch = unique.slice(start, start + LEAGUE_HYDRATION_CONCURRENCY);

		// Batches run sequentially to cap concurrency; within a batch the
		// per-id fetches are parallel.
		const settled = await Promise.all(
			batch.map((id) => getLeagueById({ id }).catch(() => undefined))
		);

		docs.push(...settled);
	}

	leagueDirectoryStore.update((current) => {
		const next = new Map(current);

		for (let i = 0; i < unique.length; i++) {
			const doc = docs[i];

			if (doc) {
				next.set(unique[i], doc);
			}
		}

		return next;
	});
};

// ─── Writes ──────────────────────────────────────────────────────────────

/**
 * Validate a league name + description per the same rules the
 * satellite assert enforces. Surfaced so the FE form can show
 * inline errors before submitting.
 */
export const validateLeagueDraft = ({
	name,
	description
}: {
	name: string;
	description?: string;
}):
	| { ok: true }
	| { ok: false; reason: 'name_too_short' | 'name_too_long' | 'description_too_long' } => {
	if (name.length < LEAGUE_NAME_MIN_LENGTH) {
		return { ok: false, reason: 'name_too_short' };
	}

	if (name.length > LEAGUE_NAME_MAX_LENGTH) {
		return { ok: false, reason: 'name_too_long' };
	}

	if (nonNullish(description) && description.length > LEAGUE_DESCRIPTION_MAX_LENGTH) {
		return { ok: false, reason: 'description_too_long' };
	}

	return { ok: true };
};

/**
 * Derive a stable, URL-friendly league id from a display name.
 * Lowercase, ASCII alphanumerics + hyphen, collapsed and trimmed.
 * Callers may pass a creation timestamp so the slug is unique even
 * when two users pick the same name.
 */
export const deriveLeagueId = ({
	name,
	suffix
}: {
	name: string;
	suffix: number | string;
}): string => {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 24);

	return `${slug || 'league'}-${suffix}`;
};

/**
 * Generate a fresh 6-char `[A-Z0-9]` invite code via the platform
 * crypto. Matches `LEAGUE_INVITE_CODE_REGEX` from `$lib/types/league`
 * so the satellite assert accepts it on first write.
 */
export const generateInviteCode = (): string => {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	const buf = new Uint8Array(6);
	crypto.getRandomValues(buf);

	let code = '';

	for (const byte of buf) {
		code += alphabet[byte % alphabet.length];
	}

	return code;
};

/**
 * Create a new league + write the owner-membership row. The
 * satellite assert enforces caller-binds-owner on both writes, so
 * the FE just signs and submits.
 *
 * Returns the created `LeagueDoc` so the caller can route to the
 * detail page or update their local list optimistically.
 */
export const createLeague = async ({
	name,
	description,
	accentColor,
	emblem,
	privacy = LeaguePrivacy.INVITE,
	inviteCode
}: {
	name: string;
	description?: string;
	/** Optional accent colour (hex) the owner picked in the create
	 *  sheet. Persisted on the league doc so the gradient logo tile is
	 *  consistent everywhere the league is rendered. */
	accentColor?: string;
	/** Single-glyph emblem the owner picked in the create sheet.
	 *  Persisted on the league doc so the logo tile reads the same
	 *  everywhere the league is rendered. */
	emblem?: string;
	/** Three-way visibility the owner picked in the create sheet.
	 *  Defaults to Invite-only (the design default); persisted on the
	 *  league doc and surfaced as the detail header's privacy chip. */
	privacy?: LeaguePrivacy;
	/** Pre-generated 6-char invite code. The create sheet surfaces the
	 *  code to the owner before submit (so they can share it), so it
	 *  passes the same value here to keep the displayed and persisted
	 *  codes identical. Omitted callers get a fresh code generated here.
	 *  Re-validated against {@link LEAGUE_INVITE_CODE_REGEX} either way. */
	inviteCode?: string;
}): Promise<LeagueDoc> => {
	const validation = validateLeagueDraft({ name, description });

	if (!validation.ok) {
		throw new Error(`Invalid league draft: ${validation.reason}`);
	}

	const identity = await safeGetIdentityOnce();
	const ownerPrincipal = identity.getPrincipal().toText();
	const createdAtMs = Date.now();
	const leagueId = deriveLeagueId({ name, suffix: createdAtMs });
	const resolvedInviteCode = inviteCode ?? generateInviteCode();

	if (!LEAGUE_INVITE_CODE_REGEX.test(resolvedInviteCode)) {
		// `generateInviteCode` is built to satisfy the regex; this
		// branch is here so a future change to either side trips the
		// FE error path instead of failing on the satellite assert.
		throw new Error('Generated invite code is malformed.');
	}

	const league: LeagueDoc = {
		id: leagueId,
		name,
		description,
		inviteCode: resolvedInviteCode,
		owner: ownerPrincipal,
		createdAtMs,
		accentColor,
		emblem,
		privacy
	};

	await setDoc<LeagueDoc>({
		collection: Collection.LEAGUES,
		doc: {
			key: leagueId,
			data: league
		}
	});

	const ownerMembership: LeagueMemberDoc = {
		leagueId,
		member: ownerPrincipal,
		joinedAtMs: createdAtMs,
		role: 'owner'
	};

	await setDoc<LeagueMemberDoc>({
		collection: Collection.LEAGUE_MEMBERS,
		doc: {
			key: leagueMemberKey({ leagueId, memberPrincipal: ownerPrincipal }),
			data: ownerMembership
		}
	});

	return league;
};

/**
 * Edit an owner-mutable league field. Only the current owner can call
 * this; the satellite assert hard-rejects anyone else. On the edit path
 * `id`, `createdAtMs`, `inviteCode`, and `emblem` stay frozen — `name`,
 * `privacy`, and `imageUrl` are the mutable fields.
 *
 * Pass `name` to rename (trimmed + re-validated against the same 3–40
 * char window the create flow enforces; an invalid name throws before
 * any write). Pass `privacy` to change the league's visibility (any of
 * the three variants; the assert range-checks it). Pass `imageUrl` to
 * set or change the cover image, or `null` to clear it (the field is
 * dropped from the doc so a cover-less league carries an absent field,
 * matching the assert's non-empty rule). Omitting a field leaves it
 * untouched.
 *
 * Re-reads the existing doc so we round-trip the server's `version`
 * token — Juno's optimistic-concurrency guard rejects an update that
 * omits it — and so unchanged fields are carried over verbatim. Returns
 * the updated `LeagueDoc` so the caller can reflect the change
 * optimistically.
 */
export const updateLeague = async ({
	id,
	name,
	privacy,
	imageUrl
}: {
	id: string;
	name?: string;
	/** New three-way visibility, or omitted to leave as-is. */
	privacy?: LeaguePrivacy;
	/** New cover-image URL, `null` to clear, or omitted to leave as-is. */
	imageUrl?: string | null;
}): Promise<LeagueDoc> => {
	const existing = await getDoc<LeagueDoc>({
		collection: Collection.LEAGUES,
		key: id
	});

	if (!existing) {
		throw new Error('League no longer exists.');
	}

	const next: LeagueDoc = { ...existing.data };

	if (nonNullish(name)) {
		const trimmedName = name.trim();

		const validation = validateLeagueDraft({ name: trimmedName });

		if (!validation.ok) {
			throw new Error(`Invalid league name: ${validation.reason}`);
		}

		next.name = trimmedName;
	}

	if (nonNullish(privacy)) {
		next.privacy = privacy;
	}

	if (nonNullish(imageUrl)) {
		const trimmedImageUrl = imageUrl?.trim() ?? '';

		if (trimmedImageUrl.length === 0) {
			delete next.imageUrl;
		} else {
			// Persist the trimmed value so the stored shape matches the assert's
			// no-surrounding-whitespace rule.
			next.imageUrl = trimmedImageUrl;
		}
	}

	await setDoc<LeagueDoc>({
		collection: Collection.LEAGUES,
		doc: {
			key: id,
			data: next,
			version: existing.version
		}
	});

	return next;
};

// Session cache for the caller's own referral code — the same value for the whole
// session, so resolve it once and reuse across every league-share build. Only a
// positive result is cached; a missing code (not yet assigned / backfilled later)
// stays retryable.
let cachedReferralCode: string | undefined;

const resolveMyReferralCode = async (): Promise<string | undefined> => {
	if (nonNullish(cachedReferralCode)) {
		return cachedReferralCode;
	}

	try {
		const code = await getMyReferralCode();

		if (nonNullish(code)) {
			cachedReferralCode = code;
		}

		return code;
	} catch {
		// Best-effort: a failed lookup falls through to `undefined`, yielding a
		// plain (no-`?ref=`) share link.
	}
};

/**
 * Builds the canonical league-invite URL (`{origin}/league/{code}`), appending
 * the sharer's referral code as `?ref={code}` so the invite also implies a friend
 * invite (auto-friendship on join, plus the new-user bonus for fresh sign-ups —
 * the landing route + onboarding drain redeem the `?ref=` exactly like a plain
 * friend invite). The param is appended only when a real referral code resolves;
 * with none available the plain link is returned (a handle would fail
 * `REFERRAL_CODE_REGEX` on the consuming side and be dropped, so it is never
 * substituted). `withReferral` lets the caller annotate analytics.
 */
export const buildLeagueShareUrl = async ({
	inviteCode
}: {
	inviteCode: string;
}): Promise<{ url: string; withReferral: boolean }> => {
	const base = `${window.location.origin}/league/${inviteCode}`;
	const referralCode = await resolveMyReferralCode();

	if (nonNullish(referralCode) && REFERRAL_CODE_REGEX.test(referralCode)) {
		return { url: `${base}?ref=${referralCode}`, withReferral: true };
	}

	return { url: base, withReferral: false };
};

/**
 * Join a league via its 6-char invite code. Looks the league up,
 * then writes a `LeagueMemberDoc` for the caller. Returns the
 * resolved league so the caller can route into it.
 *
 * Throws if the code is malformed, unknown, or the caller is
 * already a member (the satellite assert rejects the second-write
 * branch).
 */
export const joinLeagueByInvite = async ({
	inviteCode
}: {
	inviteCode: string;
}): Promise<LeagueDoc> => {
	if (!LEAGUE_INVITE_CODE_REGEX.test(inviteCode)) {
		throw new Error('Invite code is malformed.');
	}

	const league = await lookupLeagueByInvite({ inviteCode });

	if (!league) {
		throw new Error('No league found for that invite code.');
	}

	const identity = await safeGetIdentityOnce();
	const memberPrincipal = identity.getPrincipal().toText();
	const joinedAtMs = Date.now();
	const key = leagueMemberKey({ leagueId: league.id, memberPrincipal });

	// If the caller is already a member, the assert would reject the
	// write with "identity fields immutable" on a stale joinedAtMs.
	// Pre-empt with a getDoc to surface a clearer error.
	const existing = await getDoc<LeagueMemberDoc>({
		collection: Collection.LEAGUE_MEMBERS,
		key
	});

	if (existing) {
		throw new Error('Already a member of this league.');
	}

	const membership: LeagueMemberDoc = {
		leagueId: league.id,
		member: memberPrincipal,
		joinedAtMs,
		role: 'member'
	};

	await setDoc<LeagueMemberDoc>({
		collection: Collection.LEAGUE_MEMBERS,
		doc: {
			key,
			data: membership
		}
	});

	return league;
};

/**
 * Leave a league — deletes the caller's membership row. The
 * satellite assert rejects this for the owner principal, so
 * ownership transfer is a precondition. Callers should disable the
 * "Leave" CTA on owner rows.
 */
export const leaveLeague = async ({ leagueId }: { leagueId: string }): Promise<void> => {
	const identity = await safeGetIdentityOnce();
	const memberPrincipal = identity.getPrincipal().toText();
	const key = leagueMemberKey({ leagueId, memberPrincipal });

	const existing = await getDoc<LeagueMemberDoc>({
		collection: Collection.LEAGUE_MEMBERS,
		key
	});

	if (!existing) {
		// Idempotent — no row to delete is success. Avoids racing
		// against an admin kick.
		return;
	}

	await deleteDoc<LeagueMemberDoc>({
		collection: Collection.LEAGUE_MEMBERS,
		doc: existing
	});
};

/**
 * Transfer league ownership to another member. The current owner
 * calls this; the satellite swaps `LEAGUES.owner` and the matching
 * `LEAGUE_MEMBERS` role rows (old owner → admin, new owner → owner).
 *
 * The call surfaces structured refusal reasons so the FE can render
 * a meaningful error: `not_owner`, `league_not_found`,
 * `new_owner_not_member`, `new_owner_is_caller`, `invalid_input`.
 * On success returns `{ ok: true }`.
 */
export interface TransferLeagueOwnershipResult {
	ok: boolean;
	reason?:
		| 'not_owner'
		| 'league_not_found'
		| 'new_owner_not_member'
		| 'new_owner_is_caller'
		| 'invalid_input';
}

export const transferLeagueOwnership = ({
	leagueId,
	newOwnerPrincipal
}: {
	leagueId: string;
	newOwnerPrincipal: string;
}): Promise<TransferLeagueOwnershipResult> =>
	functions.transferLeagueOwnership({ leagueId, newOwnerPrincipal });

// ─── Battles ───────────────────────────────────────────────────────────────

const projectBattleWire = (b: {
	id: string;
	kind: BattleDoc['kind'];
	sideA: string;
	sideB: string;
	proposer: string;
	state: BattleDoc['state'];
	kickoffMs: number;
	settleMs: number;
	scope?: string;
	wager?: number;
	trashTalk?: string;
	scoreA?: number;
	scoreB?: number;
	winner?: BattleDoc['winner'];
}): BattleDoc => ({
	id: b.id,
	kind: b.kind,
	sideA: b.sideA,
	sideB: b.sideB,
	proposer: b.proposer,
	state: b.state,
	kickoffMs: b.kickoffMs,
	settleMs: b.settleMs,
	// Re-narrow the loose wire string back to the typed union; drop
	// anything outside the closed scope set (legacy / unknown).
	scope: nonNullish(b.scope) && isBattleScope(b.scope) ? b.scope : undefined,
	wager: b.wager,
	trashTalk: b.trashTalk,
	scoreA: b.scoreA,
	scoreB: b.scoreB,
	winner: b.winner
});

/**
 * List every battle involving the given league — both sides scanned.
 * Projects the satellite's snake_case wire schema to camelCase
 * `BattleDoc` for the FE.
 */
export const listLeagueBattles = async ({
	leagueId
}: {
	leagueId: string;
}): Promise<BattleDoc[]> => {
	const { items } = await functions.listLeagueBattles({ leagueId });

	return items.map(projectBattleWire);
};

/**
 * List every battle across every league the caller belongs to. Powers
 * the `/arena/battles` cross-league inbox. Sorted server-side by
 * `kickoffMs` ascending.
 */
export const listMyBattles = async (): Promise<BattleDoc[]> => {
	const { items } = await functions.listMyBattles();

	return items.map(projectBattleWire);
};

/**
 * Count of resolved battles the caller's side won, tallied
 * server-side — duels by principal match on the winning side, league
 * bouts by ownership of the winning league. Backs the profile's
 * `boutsWon` counter in the stats sync without paging the full battle
 * list.
 */
export const getMyBattleStats = async (): Promise<{ boutsWon: number }> =>
	await functions.getMyBattleStats();

/**
 * Propose a new battle (kind='league'). Caller must own the `sideA`
 * league; the satellite assert hard-rejects otherwise. The opponent
 * (sideB) league doesn't need to exist on the satellite for the
 * proposal to land — accept goes through a separate assert pass
 * under the opponent owner's caller identity.
 */
export const proposeBattle = async ({
	sideA,
	sideB,
	kickoffMs,
	settleMs,
	scope,
	wager,
	trashTalk
}: {
	sideA: string;
	sideB: string;
	kickoffMs: number;
	settleMs: number;
	scope?: BattleScope;
	wager?: number;
	trashTalk?: string;
}): Promise<BattleDoc> => {
	if (kickoffMs >= settleMs) {
		throw new Error('Kickoff must be strictly before settle.');
	}

	if (nonNullish(scope) && !isBattleScope(scope)) {
		throw new Error(`Invalid battle scope "${scope}".`);
	}

	if (
		nonNullish(wager) &&
		(!Number.isFinite(wager) || wager < BATTLE_WAGER_MIN || wager > BATTLE_WAGER_MAX)
	) {
		throw new Error(`Wager must be within [${BATTLE_WAGER_MIN}, ${BATTLE_WAGER_MAX}].`);
	}

	// Trim, then drop an empty trash-talk so we never persist a blank
	// string for an absent message.
	const trimmedTrashTalk = trashTalk?.trim();

	if (nonNullish(trimmedTrashTalk) && trimmedTrashTalk.length > BATTLE_TRASH_TALK_MAX_LENGTH) {
		throw new Error(`Trash talk must be at most ${BATTLE_TRASH_TALK_MAX_LENGTH} characters.`);
	}

	const identity = await safeGetIdentityOnce();
	const proposerPrincipal = identity.getPrincipal().toText();
	const battleId = `${sideA}--vs--${sideB}-${Date.now().toString(36)}`;

	const battle: BattleDoc = {
		id: battleId,
		kind: 'league',
		sideA,
		sideB,
		proposer: proposerPrincipal,
		state: 'proposed',
		kickoffMs,
		settleMs,
		// Persist scope only when narrowed (omit the 'all' default so legacy
		// reads and the default render path stay identical).
		...(nonNullish(scope) && scope !== 'all' ? { scope } : {}),
		// Persist wager only when staked (omit a 0 wager).
		...(nonNullish(wager) && wager > BATTLE_WAGER_MIN ? { wager } : {}),
		// Persist trash-talk only when non-empty after trimming.
		...(nonNullish(trimmedTrashTalk) && trimmedTrashTalk.length > 0
			? { trashTalk: trimmedTrashTalk }
			: {})
	};

	await setDoc<BattleDoc>({
		collection: Collection.BATTLES,
		doc: { key: battleId, data: battle }
	});

	return battle;
};

/**
 * Battle state transitions — thin write helpers. The satellite assert
 * (BE-6) enforces the forward-only state machine + per-transition
 * authorisation; the FE just packages the doc + signs the call.
 *
 * All three read the existing doc first so we round-trip the
 * server's `version` token, which Juno's optimistic-concurrency guard
 * requires on every update of an existing doc.
 */
export const acceptBattle = async ({ battle }: { battle: BattleDoc }): Promise<BattleDoc> => {
	const next: BattleDoc = { ...battle, state: 'accepted' };
	await writeBattleTransition({ battle, next });

	return next;
};

export const kickoffBattle = async ({ battle }: { battle: BattleDoc }): Promise<BattleDoc> => {
	const next: BattleDoc = { ...battle, state: 'in_flight' };
	await writeBattleTransition({ battle, next });

	return next;
};

/**
 * Retract a `proposed`-state battle. Only the original proposer can
 * call this; the satellite assert hard-rejects anyone else and any
 * battle past `proposed`.
 */
export const retractBattle = async ({ battle }: { battle: BattleDoc }): Promise<void> => {
	if (battle.state !== 'proposed') {
		throw new Error('Only proposed battles can be retracted.');
	}

	const existing = await getDoc<BattleDoc>({
		collection: Collection.BATTLES,
		key: battle.id
	});

	if (!existing) {
		throw new Error('Battle no longer exists.');
	}

	await deleteDoc<BattleDoc>({
		collection: Collection.BATTLES,
		doc: {
			key: battle.id,
			data: existing.data,
			version: existing.version
		}
	});
};

export const resolveBattle = async ({
	battle,
	scoreA,
	scoreB
}: {
	battle: BattleDoc;
	scoreA: number;
	scoreB: number;
}): Promise<BattleDoc> => {
	const winner = scoreA > scoreB ? 'A' : scoreA < scoreB ? 'B' : 'draw';
	const next: BattleDoc = { ...battle, state: 'resolved', scoreA, scoreB, winner };
	await writeBattleTransition({ battle, next });

	return next;
};

const writeBattleTransition = async ({
	battle,
	next
}: {
	battle: BattleDoc;
	next: BattleDoc;
}): Promise<void> => {
	const existing = await getDoc<BattleDoc>({
		collection: Collection.BATTLES,
		key: battle.id
	});

	if (!existing) {
		throw new Error('Battle no longer exists.');
	}

	await setDoc<BattleDoc>({
		collection: Collection.BATTLES,
		doc: {
			key: battle.id,
			data: next,
			version: existing.version
		}
	});
};
