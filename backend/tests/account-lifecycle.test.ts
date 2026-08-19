// Account lifecycle semantics: input validation, the blocking-league guard
// and its resolutions, the soft-delete + once-per-departure exit signal, the
// recovery window (clear inside, purge past), the hard-delete cascade with
// the survivor-transfer rule, hibernation, and the retention sweep.

import { isNullish } from '@dfinity/utils';
import { beforeAll, describe, expect, test } from 'bun:test';
import {
	ACCOUNT_RECOVERY_WINDOW_MS,
	deleteMyAccount,
	findBlockingLeagueIds,
	hardDeleteAccount,
	hibernateMyAccount,
	recoverMyAccount,
	resumeMyAccount,
	sweepExpiredDeletions
} from '../src/account/lifecycle';
import { getOrAssignReferralCode, redeemReferralCode } from '../src/account/referrals';
import { query } from '../src/db/client';
import { createLeague } from '../src/leagues/leagues';
import { joinLeagueByInvite } from '../src/leagues/members';
import { createTestUser, ensureMigrated } from './helpers/auth';
import { createTestProfile } from './helpers/profiles';

beforeAll(async () => {
	await ensureMigrated();
});

const uniqueLeagueId = (): string => `lg-${crypto.randomUUID().slice(0, 12)}`;

const deletedAtMs = async (userId: string): Promise<number | undefined> => {
	const rows = await query<{ deleted_at_ms: string | null }>(
		`select deleted_at_ms from profiles where user_id = $1`,
		[userId]
	);

	const marker = rows[0]?.deleted_at_ms;

	return isNullish(marker) ? undefined : Number(marker);
};

const countRows = async (table: string, column: string, userId: string): Promise<number> => {
	const rows = await query<{ count: string }>(
		`select count(*)::text as count from ${table} where ${column} = $1`,
		[userId]
	);

	return Number(rows[0]?.count ?? 0);
};

const exitSignalCount = async (): Promise<number> => {
	const rows = await query<{ count: string }>(`select count(*)::text as count from exit_signals`);

	return Number(rows[0]?.count ?? 0);
};

describe('input validation', () => {
	test('an unknown reason and an over-long note both refuse as invalid_input', async () => {
		const { userId } = await createTestProfile();

		expect(await deleteMyAccount({ userId, reason: 'nonsense', note: '' })).toEqual({
			ok: false,
			reason: 'invalid_input'
		});
		expect(await deleteMyAccount({ userId, reason: 'bugs', note: 'x'.repeat(241) })).toEqual({
			ok: false,
			reason: 'invalid_input'
		});
		expect(await deletedAtMs(userId)).toBeUndefined();
	});
});

describe('blocking-league guard + resolutions', () => {
	test('an owned league with another member blocks deletion and is listed in the pre-flight', async () => {
		const { userId: owner } = await createTestProfile();
		const { userId: member } = await createTestProfile();
		const league = await createLeague({
			id: uniqueLeagueId(),
			name: 'Guarded League',
			ownerUserId: owner
		});

		await joinLeagueByInvite({ inviteCode: league.inviteCode, userId: member });

		expect(await findBlockingLeagueIds(owner)).toEqual([league.id]);

		const result = await deleteMyAccount({ userId: owner, reason: 'other', note: '' });

		expect(result).toEqual({
			ok: false,
			reason: 'owns_non_empty_league',
			blockingLeagueIds: [league.id]
		});
		expect(await deletedAtMs(owner)).toBeUndefined();
	});

	test('a transfer resolution unblocks the delete; a failing resolution aborts it', async () => {
		const { userId: owner } = await createTestProfile();
		const { userId: member } = await createTestProfile();
		const league = await createLeague({
			id: uniqueLeagueId(),
			name: 'Handover League',
			ownerUserId: owner
		});

		await joinLeagueByInvite({ inviteCode: league.inviteCode, userId: member });

		const outsider = await createTestUser();
		const failing = await deleteMyAccount({
			userId: owner,
			reason: 'other',
			note: '',
			leagueResolutions: [{ leagueId: league.id, action: 'transfer', transferTo: outsider }]
		});

		expect(failing).toEqual({
			ok: false,
			reason: 'league_resolution_failed',
			failedLeagueId: league.id,
			resolutionReason: 'new_owner_not_member'
		});

		const result = await deleteMyAccount({
			userId: owner,
			reason: 'other',
			note: '',
			leagueResolutions: [{ leagueId: league.id, action: 'transfer', transferTo: member }]
		});

		expect(result).toEqual({ ok: true, softDeleted: true });

		const owners = await query<{ owner_user_id: string }>(
			`select owner_user_id from leagues where id = $1`,
			[league.id]
		);

		expect(owners[0]?.owner_user_id).toBe(member);
	});

	test('a delete resolution disbands the league on the way out', async () => {
		const { userId: owner } = await createTestProfile();
		const { userId: member } = await createTestProfile();
		const league = await createLeague({
			id: uniqueLeagueId(),
			name: 'Disband League',
			ownerUserId: owner
		});

		await joinLeagueByInvite({ inviteCode: league.inviteCode, userId: member });

		const result = await deleteMyAccount({
			userId: owner,
			reason: 'other',
			note: '',
			leagueResolutions: [{ leagueId: league.id, action: 'delete' }]
		});

		expect(result).toEqual({ ok: true, softDeleted: true });

		const leagues = await query<{ id: string }>(`select id from leagues where id = $1`, [
			league.id
		]);

		expect(leagues).toHaveLength(0);
	});
});

describe('soft delete + exit signal', () => {
	test('marks the profile, writes one anonymous exit signal, and never re-counts a re-delete', async () => {
		const { userId } = await createTestProfile();
		const before = await exitSignalCount();

		const first = await deleteMyAccount({ userId, reason: 'privacy', note: 'a short note' });

		expect(first).toEqual({ ok: true, softDeleted: true });

		const marker = await deletedAtMs(userId);

		expect(marker).toBeGreaterThan(0);
		expect(await exitSignalCount()).toBe(before + 1);

		const again = await deleteMyAccount({ userId, reason: 'bugs', note: '' });

		expect(again).toEqual({ ok: true, softDeleted: true });
		// Earliest mark wins and the signal stays single per departure.
		expect(await deletedAtMs(userId)).toBe(marker);
		expect(await exitSignalCount()).toBe(before + 1);

		const signals = await query<{ reason: string; note: string }>(
			`select reason, note from exit_signals order by created_at desc limit 1`
		);

		expect(signals[0]).toEqual({ reason: 'privacy', note: 'a short note' });
	});

	test('a caller with no profile soft-deletes nothing but still succeeds', async () => {
		const userId = await createTestUser();

		expect(await deleteMyAccount({ userId, reason: 'other', note: '' })).toEqual({
			ok: true,
			softDeleted: false
		});
	});
});

describe('recover', () => {
	test('inside the window the marker clears; not-deleted is a clean no-op', async () => {
		const { userId } = await createTestProfile();

		expect(await recoverMyAccount(userId)).toEqual({ ok: true, recovered: false });

		await deleteMyAccount({ userId, reason: 'too-busy', note: '' });

		expect(await recoverMyAccount(userId)).toEqual({ ok: true, recovered: true });
		expect(await deletedAtMs(userId)).toBeUndefined();
	});

	test('past the window the account is purged and the recovery refused', async () => {
		const { userId } = await createTestProfile();

		await deleteMyAccount({ userId, reason: 'duplicate', note: '' });
		await query(`update profiles set deleted_at_ms = $2 where user_id = $1`, [
			userId,
			Date.now() - ACCOUNT_RECOVERY_WINDOW_MS - 1000
		]);

		expect(await recoverMyAccount(userId)).toEqual({ ok: false, reason: 'expired' });
		expect(await countRows('profiles', 'user_id', userId)).toBe(0);
	});
});

describe('hard-delete cascade', () => {
	test('removes the identity-keyed rows and disbands an empty owned league', async () => {
		const { userId } = await createTestProfile();
		const { userId: friend } = await createTestProfile();
		const league = await createLeague({
			id: uniqueLeagueId(),
			name: 'Orphan League',
			ownerUserId: userId
		});

		await getOrAssignReferralCode(userId);
		await redeemReferralCode({ userId, code: await getOrAssignReferralCode(friend) });
		await query(
			`insert into affiliations (member_user_id, kind, affiliation_identifier, joined_at_ms, locked_until_ms)
			 values ($1, 'university', 'mit', $2, $2)`,
			[userId, Date.now()]
		);

		await hardDeleteAccount(userId);

		expect(await countRows('profiles', 'user_id', userId)).toBe(0);
		expect(await countRows('referral_codes', 'owner_user_id', userId)).toBe(0);
		expect(await countRows('referrals', 'referee_user_id', userId)).toBe(0);
		expect(await countRows('affiliations', 'member_user_id', userId)).toBe(0);
		expect(await countRows('relations', 'participant_one', userId)).toBe(0);
		expect(await countRows('relations', 'participant_two', userId)).toBe(0);
		expect(await countRows('league_members', 'member_user_id', userId)).toBe(0);

		const leagues = await query<{ id: string }>(`select id from leagues where id = $1`, [
			league.id
		]);

		expect(leagues).toHaveLength(0);

		// The identity anchor survives the cascade.
		expect(await countRows('users', 'id', userId)).toBe(1);
	});

	test('an owned league that gained members transfers to a deterministic survivor instead of dying', async () => {
		const { userId: owner } = await createTestProfile();
		const { userId: joiner } = await createTestProfile();
		const league = await createLeague({
			id: uniqueLeagueId(),
			name: 'Survivor League',
			ownerUserId: owner
		});

		// The member joins AFTER the soft-delete: the guard-less purge paths
		// must hand the league over rather than orphan the new member.
		await deleteMyAccount({ userId: owner, reason: 'other', note: '' });
		await joinLeagueByInvite({ inviteCode: league.inviteCode, userId: joiner });

		await hardDeleteAccount(owner);

		const owners = await query<{ owner_user_id: string }>(
			`select owner_user_id from leagues where id = $1`,
			[league.id]
		);
		const roles = await query<{ role: string }>(
			`select role from league_members where league_id = $1 and member_user_id = $2`,
			[league.id, joiner]
		);

		expect(owners[0]?.owner_user_id).toBe(joiner);
		expect(roles[0]?.role).toBe('owner');
	});
});

describe('hibernate + resume', () => {
	test('the full round-trip, with the deleted and no-profile refusals', async () => {
		const { userId } = await createTestProfile();

		expect(await hibernateMyAccount(userId)).toEqual({ ok: true });
		expect(await resumeMyAccount(userId)).toEqual({ ok: true, resumed: true });
		expect(await resumeMyAccount(userId)).toEqual({ ok: true, resumed: false });

		await deleteMyAccount({ userId, reason: 'other', note: '' });

		expect(await hibernateMyAccount(userId)).toEqual({ ok: false, reason: 'deleted' });
		expect(await hibernateMyAccount(await createTestUser())).toEqual({
			ok: false,
			reason: 'no_profile'
		});
	});
});

describe('sweep', () => {
	test('purges only accounts past the recovery window and reports the count', async () => {
		const { userId: expired } = await createTestProfile();
		const { userId: fresh } = await createTestProfile();

		await deleteMyAccount({ userId: expired, reason: 'other', note: '' });
		await deleteMyAccount({ userId: fresh, reason: 'other', note: '' });
		await query(`update profiles set deleted_at_ms = $2 where user_id = $1`, [
			expired,
			Date.now() - ACCOUNT_RECOVERY_WINDOW_MS - 1000
		]);

		const { swept } = await sweepExpiredDeletions();

		expect(swept).toBeGreaterThanOrEqual(1);
		expect(await countRows('profiles', 'user_id', expired)).toBe(0);
		expect(await countRows('profiles', 'user_id', fresh)).toBe(1);

		// Idempotent: purged accounts carry no profile row any more.
		const again = await sweepExpiredDeletions();

		expect(await countRows('profiles', 'user_id', expired)).toBe(0);
		expect(again.swept).toBe(0);
	});
});
