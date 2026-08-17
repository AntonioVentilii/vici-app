// Activity feed reactions: the transactional like/unlike rollup, its
// consistency under concurrent-ish writes, and the admin recompute that
// heals drift.

import { beforeAll, describe, expect, test } from 'bun:test';
import { query } from '../src/db/client';
import {
	createActivity,
	getReactionCounts,
	likeActivity,
	listActivities,
	listReactions,
	recomputeActivityReactionCounts,
	unlikeActivity
} from '../src/social/activities';
import { createTestUser, ensureMigrated } from './helpers/auth';
import { dbAvailable } from './helpers/setup';

const countOf = async (activityKey: string): Promise<number | undefined> => {
	const counts = await getReactionCounts({ activityKeys: [activityKey] });

	return counts[0]?.count;
};

describe.if(dbAvailable)('activities', () => {
	beforeAll(async () => {
		await ensureMigrated();
	});

	test('creates a keyed activity and lists it', async () => {
		const userId = await createTestUser();
		const timestamp = Date.now();

		const activity = await createActivity({
			userId,
			type: 'trade',
			title: 'Placed a prediction',
			marketId: 'srs_1',
			timestamp
		});

		expect(activity.key).toBe(`${userId}#${timestamp}#trade`);

		const items = await listActivities({ limit: 50 });

		expect(items.some((item) => item.key === activity.key)).toBe(true);
	});

	test('rejects unknown types and unsafe timestamps', async () => {
		const userId = await createTestUser();

		expect(
			createActivity({ userId, type: 'bogus', title: 't', timestamp: Date.now() })
		).rejects.toThrow('Unknown activity type');

		expect(
			createActivity({ userId, type: 'trade', title: 't', timestamp: Number.MAX_SAFE_INTEGER + 1 })
		).rejects.toThrow('safe integer');
	});

	test('filters by type', async () => {
		const userId = await createTestUser();

		await createActivity({ userId, type: 'comment', title: 'c', timestamp: Date.now() });

		const comments = await listActivities({ limit: 100, type: 'comment' });

		expect(comments.length).toBeGreaterThan(0);
		expect(comments.every((item) => item.type === 'comment')).toBe(true);
	});
});

describe.if(dbAvailable)('reaction rollup', () => {
	beforeAll(async () => {
		await ensureMigrated();
	});

	const seedActivity = async (): Promise<string> => {
		const userId = await createTestUser();
		const activity = await createActivity({
			userId,
			type: 'trade',
			title: 'Placed a prediction',
			timestamp: Date.now()
		});

		return activity.key;
	};

	test('like increments once; a re-like does not double-count', async () => {
		const activityKey = await seedActivity();
		const liker = await createTestUser();

		await likeActivity({ likerId: liker, activityKey, timestamp: Date.now(), activityTitle: 't' });

		expect(await countOf(activityKey)).toBe(1);

		await likeActivity({ likerId: liker, activityKey, timestamp: Date.now(), activityTitle: 't' });

		expect(await countOf(activityKey)).toBe(1);
	});

	test('unlike decrements to zero and never below', async () => {
		const activityKey = await seedActivity();
		const liker = await createTestUser();

		await likeActivity({ likerId: liker, activityKey, timestamp: Date.now(), activityTitle: 't' });
		await unlikeActivity({ likerId: liker, activityKey });

		expect(await countOf(activityKey)).toBe(0);

		// Unliking again is a no-op, not a negative count.
		await unlikeActivity({ likerId: liker, activityKey });

		expect(await countOf(activityKey)).toBe(0);
	});

	test('concurrent-ish likes from distinct users land an exact count', async () => {
		const activityKey = await seedActivity();
		const likers = await Promise.all(Array.from({ length: 8 }, () => createTestUser()));

		await Promise.all(
			likers.map((likerId) =>
				likeActivity({ likerId, activityKey, timestamp: Date.now(), activityTitle: 't' })
			)
		);

		expect(await countOf(activityKey)).toBe(8);

		await Promise.all(likers.map((likerId) => unlikeActivity({ likerId, activityKey })));

		expect(await countOf(activityKey)).toBe(0);
	});

	test('rejects a malformed activity key and an oversized title', async () => {
		const liker = await createTestUser();

		expect(
			likeActivity({
				likerId: liker,
				activityKey: 'not-a-key',
				timestamp: Date.now(),
				activityTitle: 't'
			})
		).rejects.toThrow('reaction key');

		expect(
			likeActivity({
				likerId: liker,
				activityKey: await seedActivity(),
				timestamp: Date.now(),
				activityTitle: 'x'.repeat(501)
			})
		).rejects.toThrow('at most 500');
	});

	test('reactions list surfaces the denormalized fields', async () => {
		const activityKey = await seedActivity();
		const liker = await createTestUser();

		await likeActivity({
			likerId: liker,
			activityKey,
			timestamp: Date.now(),
			activityTitle: 'Denormalized title',
			marketId: 'srs_9'
		});

		const reactions = await listReactions({ limit: 1000 });
		const mine = reactions.find((r) => r.activityKey === activityKey && r.liker === liker);

		expect(mine?.activityTitle).toBe('Denormalized title');
		expect(mine?.marketId).toBe('srs_9');
	});

	test('recompute heals a drifted counter and zeroes an orphaned one', async () => {
		const activityKey = await seedActivity();
		const liker = await createTestUser();

		await likeActivity({ likerId: liker, activityKey, timestamp: Date.now(), activityTitle: 't' });

		// Drift the counter away from the reaction rows.
		await query(`update activity_reaction_counts set count = 5 where activity_key = $1`, [
			activityKey
		]);

		// Orphan counter: no reaction rows behind it.
		const orphanKey = await seedActivity();

		await query(
			`insert into activity_reaction_counts (activity_key, count, updated_at_ms) values ($1, 3, $2)`,
			[orphanKey, Date.now()]
		);

		const { recomputed } = await recomputeActivityReactionCounts();

		expect(recomputed).toBeGreaterThanOrEqual(2);
		expect(await countOf(activityKey)).toBe(1);
		expect(await countOf(orphanKey)).toBe(0);
	});
});
