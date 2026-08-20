// Leaderboard surface: the visible top slice, the single-pass rank/count
// pair, the caller's rival and the monthly award aggregation. All reads
// back public surfaces except the rival, which is caller-scoped.

import { isNullish } from '@dfinity/utils';
import { Elysia } from 'elysia';
import { requireUser, unauthenticated } from '../auth/guard';
import { getMyRival, getUserRankAndCount, listLeaderboard } from '../profiles/leaderboard';
import { getMonthlyLeaderboard } from '../profiles/stats';

export const leaderboardRoutes = new Elysia({ prefix: '/api/v1/leaderboard' })
	.get('/', async () => ({ items: await listLeaderboard() }))
	.get('/rival', async ({ request, set }) => {
		const user = await requireUser(request);

		if (isNullish(user)) {
			return unauthenticated(set);
		}

		const { rival, rivalIsTrailing } = await getMyRival({ userId: user.id });

		return { rival: rival ?? null, rivalIsTrailing };
	})
	.get(
		'/monthly/:monthAnchor',
		async ({ params }) => await getMonthlyLeaderboard({ monthAnchor: params.monthAnchor })
	)
	.get('/rank/:userId', async ({ params }) => {
		const { rank, count } = await getUserRankAndCount({ userId: params.userId });

		return { rank: rank ?? null, count };
	});
