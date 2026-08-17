// Profile surface: own-profile read/write, the availability probe, public
// lookup and search, the server-authoritative Flow swipe counter, and the
// dashboard stat caches. Reads that back public surfaces stay public;
// everything caller-scoped is session-gated.

import { isNullish } from '@dfinity/utils';
import { Elysia, t } from 'elysia';
import { requireUser, unauthenticated } from '../auth/guard';
import { NoProfileError, recordFlowSwipe } from '../profiles/flow';
import { checkNicknameAvailability } from '../profiles/nickname';
import {
	getProfileRow,
	getProfileView,
	ProfileValidationError,
	searchProfiles,
	shapeProfile,
	upsertMyProfile
} from '../profiles/profile';
import { getUserStats, upsertMonthlyStats, upsertUserStats } from '../profiles/stats';

interface StatusContext {
	status?: number | string;
}

const badRequest = (set: StatusContext, error: string): { error: string } => {
	set.status = 400;

	return { error };
};

export const profilesRoutes = new Elysia({ prefix: '/api/v1/profiles' })
	.get('/me', async ({ request, set }) => {
		const user = await requireUser(request);

		if (isNullish(user)) {
			return unauthenticated(set);
		}

		const row = await getProfileRow({ userId: user.id });

		return { profile: isNullish(row) ? null : shapeProfile(row) };
	})
	.put('/me', async ({ request, set, body }) => {
		const user = await requireUser(request);

		if (isNullish(user)) {
			return unauthenticated(set);
		}

		try {
			const profile = await upsertMyProfile({
				userId: user.id,
				body: (body ?? {}) as Record<string, unknown>
			});

			return { profile };
		} catch (err) {
			if (err instanceof ProfileValidationError) {
				return badRequest(set, err.message);
			}

			throw err;
		}
	})
	.get(
		'/nickname-availability',
		async ({ request, set, query: params }) => {
			const user = await requireUser(request);

			if (isNullish(user)) {
				return unauthenticated(set);
			}

			// The caller's own current nickname never counts as a conflict.
			const result = await checkNicknameAvailability({
				nickname: params.nickname,
				excludeUserId: user.id
			});

			return result;
		},
		{ query: t.Object({ nickname: t.String() }) }
	)
	.get('/search', async ({ query: params }) => ({ items: await searchProfiles(params.q) }), {
		query: t.Object({ q: t.String() })
	})
	.post(
		'/flow-swipe',
		async ({ request, set, body }) => {
			const user = await requireUser(request);

			if (isNullish(user)) {
				return unauthenticated(set);
			}

			try {
				return await recordFlowSwipe({ userId: user.id, dayKey: body.dayKey });
			} catch (err) {
				if (err instanceof NoProfileError) {
					set.status = 409;

					return { error: 'no_profile' };
				}

				if (err instanceof Error && err.message.includes('well-formed')) {
					return badRequest(set, 'invalid_day_key');
				}

				throw err;
			}
		},
		{ body: t.Object({ dayKey: t.String() }) }
	)
	.get('/me/stats', async ({ request, set }) => {
		const user = await requireUser(request);

		if (isNullish(user)) {
			return unauthenticated(set);
		}

		return { stats: (await getUserStats({ userId: user.id })) ?? null };
	})
	.put(
		'/me/stats',
		async ({ request, set, body }) => {
			const user = await requireUser(request);

			if (isNullish(user)) {
				return unauthenticated(set);
			}

			try {
				const stats = await upsertUserStats({
					userId: user.id,
					categoryStats: body.categoryStats,
					recentSettlements: body.recentSettlements,
					computedAtMs: body.computedAtMs
				});

				return { stats };
			} catch (err) {
				if (err instanceof ProfileValidationError) {
					return badRequest(set, err.message);
				}

				throw err;
			}
		},
		{
			body: t.Object({
				categoryStats: t.Record(t.String(), t.Object({ calls: t.Number(), wins: t.Number() })),
				recentSettlements: t.Array(
					t.Object({
						marketId: t.String(),
						tag: t.String(),
						win: t.Boolean(),
						settledAtMs: t.Number(),
						vxp: t.Number(),
						contrarian: t.Boolean()
					})
				),
				computedAtMs: t.Number()
			})
		}
	)
	.put(
		'/me/monthly-stats',
		async ({ request, set, body }) => {
			const user = await requireUser(request);

			if (isNullish(user)) {
				return unauthenticated(set);
			}

			try {
				const stats = await upsertMonthlyStats({
					userId: user.id,
					monthAnchor: body.monthAnchor,
					monthCalls: body.monthCalls,
					monthWins: body.monthWins,
					monthConsensus: body.monthConsensus,
					updatedAtMs: body.updatedAtMs
				});

				return { stats };
			} catch (err) {
				if (err instanceof ProfileValidationError) {
					return badRequest(set, err.message);
				}

				throw err;
			}
		},
		{
			body: t.Object({
				monthAnchor: t.String(),
				monthCalls: t.Number(),
				monthWins: t.Number(),
				monthConsensus: t.Array(t.Number()),
				updatedAtMs: t.Number()
			})
		}
	)
	.get('/:userId', async ({ request, params }) => {
		// The caller (when signed in) may read their own hidden profile; any
		// other hidden profile reads as absent.
		const user = await requireUser(request);

		const profile = await getProfileView({
			userId: params.userId,
			callerId: user?.id
		});

		return { profile: profile ?? null };
	});
