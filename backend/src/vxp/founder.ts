// League-founder reward: 100 VXP once per league a user founds, keyed by
// league id so retries are naturally idempotent. Founding a league is free,
// so the per-account cap bounds an otherwise unbounded mint. The league
// domain itself lands with the leagues phase; this exposes the award side so
// the create-league path (and its retroactive self-heal pass) can call it.

import { logger } from '../lib/logger';
import { countUserAwards, grantAward } from './awards';
import { VXP_LEAGUE_FOUNDER_MAX_AWARDS, VXP_LEAGUE_FOUNDER_REWARD_BASE_UNITS } from './constants';

export type FounderPayoutOutcome = 'paid' | 'recorded' | 'already' | 'capped' | 'failed';

/**
 * Grants the founder reward for one league. Idempotent per league; the
 * per-account cap is counted off the caller's own league_founder awards, and
 * anything in flight consumes a slot so racing creates cannot slip past it.
 */
export const grantLeagueFounderAward = async ({
	userId,
	leagueId
}: {
	userId: string;
	leagueId: string;
}): Promise<FounderPayoutOutcome> => {
	try {
		if (
			(await countUserAwards({ userId, awardType: 'league_founder' })) >=
			VXP_LEAGUE_FOUNDER_MAX_AWARDS
		) {
			logger.info(
				`league founder award capped for ${userId} (league ${leagueId}, cap ${VXP_LEAGUE_FOUNDER_MAX_AWARDS})`
			);

			return 'capped';
		}

		const outcome = await grantAward({
			userId,
			awardType: 'league_founder',
			awardKey: leagueId,
			amountBaseUnits: VXP_LEAGUE_FOUNDER_REWARD_BASE_UNITS,
			memo: `vxp:league_founder:${leagueId}`
		});

		switch (outcome.outcome) {
			case 'paid':
				return 'paid';
			case 'recorded':
				return 'recorded';
			case 'already':
				return 'already';
			default:
				return 'failed';
		}
	} catch (err) {
		logger.error(`league founder award failed (${leagueId} for ${userId}):`, err);

		return 'failed';
	}
};

/**
 * Retroactive self-heal: pays any of the caller's owned leagues that still
 * lack a founder award, sequentially so the per-account cap holds across the
 * batch. Idempotent and safe to call on every Leagues-page mount; the
 * leagues phase passes the caller's owned league ids.
 */
export const settleFounderAwards = async ({
	userId,
	ownedLeagueIds
}: {
	userId: string;
	ownedLeagueIds: string[];
}): Promise<{ settled: number }> => {
	let settled = 0;

	for (const leagueId of ownedLeagueIds) {
		const outcome = await grantLeagueFounderAward({ userId, leagueId });

		if (outcome === 'paid' || outcome === 'recorded') {
			settled += 1;
		}
	}

	return { settled };
};
