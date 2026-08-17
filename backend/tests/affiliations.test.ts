// Worlds affiliations: the server-computed 90-day lock on leave and switch,
// idempotent re-join, the two-slot model, and the roster / member-count
// reads.

import { beforeAll, describe, expect, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import {
	AFFILIATION_LOCK_MS,
	getMyAffiliation,
	listMyAffiliations,
	listWorldsMemberCounts,
	listWorldsRoster,
	removeAffiliation,
	setAffiliation
} from '../src/worlds/affiliations';
import { createTestUser, ensureMigrated } from './helpers/auth';
import { dbAvailable } from './helpers/setup';

const uniqueSlug = (): string => `school-${randomBytes(6).toString('hex')}`;

describe.if(dbAvailable)('affiliation lock', () => {
	beforeAll(async () => {
		await ensureMigrated();
	});

	test('join computes lockedUntilMs as joinedAtMs + 90 days server-side', async () => {
		const userId = await createTestUser();
		const nowMs = Date.now();

		const affiliation = await setAffiliation({
			userId,
			kind: 'university',
			affiliationIdentifier: uniqueSlug(),
			nowMs
		});

		expect(affiliation.joinedAtMs).toBe(nowMs);
		expect(affiliation.lockedUntilMs).toBe(nowMs + AFFILIATION_LOCK_MS);
	});

	test('leave is blocked during the lock and allowed after it expires', async () => {
		const userId = await createTestUser();
		const slug = uniqueSlug();
		const nowMs = Date.now();

		await setAffiliation({ userId, kind: 'university', affiliationIdentifier: slug, nowMs });

		expect(
			removeAffiliation({
				userId,
				kind: 'university',
				affiliationIdentifier: slug,
				nowMs: nowMs + AFFILIATION_LOCK_MS - 1000
			})
		).rejects.toThrow('lock active');

		const result = await removeAffiliation({
			userId,
			kind: 'university',
			affiliationIdentifier: slug,
			nowMs: nowMs + AFFILIATION_LOCK_MS + 1000
		});

		expect(result.ok).toBe(true);
		expect(await getMyAffiliation({ userId, kind: 'university' })).toBeUndefined();
	});

	test('switching identifier of a held kind is gated by the same lock', async () => {
		const userId = await createTestUser();
		const first = uniqueSlug();
		const second = uniqueSlug();
		const nowMs = Date.now();

		await setAffiliation({ userId, kind: 'country', affiliationIdentifier: first, nowMs });

		expect(
			setAffiliation({
				userId,
				kind: 'country',
				affiliationIdentifier: second,
				nowMs: nowMs + 1000
			})
		).rejects.toThrow('lock active');

		const switched = await setAffiliation({
			userId,
			kind: 'country',
			affiliationIdentifier: second,
			nowMs: nowMs + AFFILIATION_LOCK_MS + 1000
		});

		expect(switched.affiliationIdentifier).toBe(second);
		expect(switched.lockedUntilMs).toBe(nowMs + AFFILIATION_LOCK_MS + 1000 + AFFILIATION_LOCK_MS);
	});

	test('re-joining the identical slot is an idempotent no-op that keeps the original lock', async () => {
		const userId = await createTestUser();
		const slug = uniqueSlug();
		const nowMs = Date.now();

		const first = await setAffiliation({
			userId,
			kind: 'university',
			affiliationIdentifier: slug,
			nowMs
		});
		const again = await setAffiliation({
			userId,
			kind: 'university',
			affiliationIdentifier: slug,
			nowMs: nowMs + 5000
		});

		expect(again.joinedAtMs).toBe(first.joinedAtMs);
		expect(again.lockedUntilMs).toBe(first.lockedUntilMs);
	});

	test('one university and one country slot can be held simultaneously', async () => {
		const userId = await createTestUser();
		const school = uniqueSlug();

		await setAffiliation({ userId, kind: 'university', affiliationIdentifier: school });
		await setAffiliation({ userId, kind: 'country', affiliationIdentifier: 'ch' });

		const mine = await listMyAffiliations(userId);

		expect(mine.university?.affiliationIdentifier).toBe(school);
		expect(mine.country?.affiliationIdentifier).toBe('ch');
	});
});

describe.if(dbAvailable)('worlds roster and member counts', () => {
	beforeAll(async () => {
		await ensureMigrated();
	});

	test('roster reads earliest joiner first; counts tally the slot', async () => {
		const slug = uniqueSlug();
		const early = await createTestUser();
		const late = await createTestUser();
		const nowMs = Date.now();

		await setAffiliation({
			userId: late,
			kind: 'university',
			affiliationIdentifier: slug,
			nowMs: nowMs + 1000
		});
		await setAffiliation({ userId: early, kind: 'university', affiliationIdentifier: slug, nowMs });

		const roster = await listWorldsRoster({ kind: 'university', affiliationIdentifier: slug });

		expect(roster.map((a) => a.memberUserId)).toEqual([early, late]);

		const counts = await listWorldsMemberCounts('university');
		const entry = counts.find((c) => c.affiliationIdentifier === slug);

		expect(entry?.memberCount).toBe(2);
	});
});
