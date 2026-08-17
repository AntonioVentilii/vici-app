// Calibration claim gates (engine mocked at the actor provider boundary)
// and the league-founder award cap.

import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { query } from '../src/db/client';
import type { ClearingService, RegistryService } from '../src/declarations';
import { setEngineActorProvider } from '../src/engine/actors';
import { clearCache } from '../src/engine/cache';
import { grantAward } from '../src/vxp/awards';
import { claimCalibrationReward } from '../src/vxp/calibration';
import { parseVxp, VXP_LEAGUE_FOUNDER_MAX_AWARDS } from '../src/vxp/constants';
import { grantLeagueFounderAward } from '../src/vxp/founder';
import { createTestUser, ensureMigrated } from './helpers/auth';
import { readAwardRow, stubVxpLedger, type LedgerStub } from './helpers/vxp';

let stub: LedgerStub | undefined;
let restoreActors: (() => void) | undefined;

beforeAll(async () => {
	await ensureMigrated();
});

afterEach(() => {
	stub?.restore();
	stub = undefined;
	restoreActors?.();
	restoreActors = undefined;
	clearCache();
});

const mockEngine = ({
	engineId = 'eng_0',
	payoff = { Binary: null },
	finalised = true,
	priceValue = BigInt(1)
}: {
	engineId?: string;
	payoff?: Record<string, null>;
	finalised?: boolean;
	priceValue?: bigint;
} = {}): void => {
	const series = { engine_id: [engineId], payoff_type: payoff };
	const view = {
		status: finalised ? { Finalised: null } : { Pending: null },
		settlement: { Price: { decimal: { value: priceValue }, timestamp: [], oracle_id: [] } }
	};

	restoreActors = setEngineActorProvider({
		clearing: () =>
			Promise.resolve({
				get_settlement_status: () => Promise.resolve([view])
			} as unknown as ClearingService),
		registry: () =>
			Promise.resolve({
				get_series: () => Promise.resolve([series])
			} as unknown as RegistryService)
	});
};

/** The onboarding m1 grant doubles as the calibration engagement gate. */
const engageUser = async (userId: string): Promise<void> => {
	await grantAward({
		userId,
		awardType: 'onboarding',
		awardKey: 'm1',
		amountBaseUnits: parseVxp(1500)
	});
};

describe('calibration gates', () => {
	test('a user without the onboarding grant is not engaged yet', async () => {
		stub = stubVxpLedger();
		mockEngine();
		const userId = await createTestUser();

		const result = await claimCalibrationReward({ userId, seriesId: 's1', chosenSide: 'YES' });

		expect(result).toEqual({
			correct: false,
			paidNow: false,
			alreadyClaimed: false,
			reason: 'not_engaged_yet'
		});
	});

	test('a healthy balance is above the recovery floor: no payout', async () => {
		stub = stubVxpLedger({ balance: () => Promise.resolve(parseVxp(150)) });
		mockEngine();
		const userId = await createTestUser();

		await engageUser(userId);

		const result = await claimCalibrationReward({ userId, seriesId: 's2', chosenSide: 'YES' });

		expect(result.reason).toBe('balance_above_floor');
	});

	test('only Vici engine markets qualify', async () => {
		stub = stubVxpLedger({ balance: () => Promise.resolve(parseVxp(10)) });
		mockEngine({ engineId: 'eng_9' });
		const userId = await createTestUser();

		await engageUser(userId);

		const result = await claimCalibrationReward({ userId, seriesId: 's3', chosenSide: 'YES' });

		expect(result.reason).toBe('not_vici_market');
	});

	test('a correct call on a finalised binary market pays 20 VXP once', async () => {
		stub = stubVxpLedger({ balance: () => Promise.resolve(parseVxp(10)) });
		mockEngine({ priceValue: BigInt(1) });
		const userId = await createTestUser();

		await engageUser(userId);

		const result = await claimCalibrationReward({ userId, seriesId: 's4', chosenSide: 'YES' });

		expect(result.correct).toBe(true);
		expect(result.paidNow).toBe(true);
		expect(result.rewardBaseUnits).toBe(parseVxp(20).toString());
		expect((await readAwardRow({ userId, awardType: 'calibration', awardKey: 's4' }))?.status).toBe(
			'paid'
		);

		const again = await claimCalibrationReward({ userId, seriesId: 's4', chosenSide: 'YES' });

		expect(again.alreadyClaimed).toBe(true);
		expect(again.paidNow).toBe(false);
	});

	test('a wrong call pays nothing, writes nothing and consumes no budget', async () => {
		stub = stubVxpLedger({ balance: () => Promise.resolve(parseVxp(10)) });
		mockEngine({ priceValue: BigInt(0) });
		const userId = await createTestUser();

		await engageUser(userId);

		const result = await claimCalibrationReward({ userId, seriesId: 's5', chosenSide: 'YES' });

		expect(result).toEqual({ correct: false, paidNow: false, alreadyClaimed: false });
		expect(
			await readAwardRow({ userId, awardType: 'calibration', awardKey: 's5' })
		).toBeUndefined();
	});

	test('the rolling hourly cap blocks a burst of correct claims', async () => {
		stub = stubVxpLedger({ balance: () => Promise.resolve(parseVxp(10)) });
		mockEngine();
		const userId = await createTestUser();

		await engageUser(userId);
		await query(
			`insert into vxp_awards (user_id, award_type, award_key, amount_base_units, status, earned_at_ms)
			 select $1, 'calibration', 'burst_' || g, $2, 'paid', 1 from generate_series(1, 6) g`,
			[userId, parseVxp(20).toString()]
		);

		const result = await claimCalibrationReward({ userId, seriesId: 's6', chosenSide: 'YES' });

		expect(result.correct).toBe(true);
		expect(result.paidNow).toBe(false);
		expect(result.reason).toBe('rate_limited_hourly');
	});
});

describe('league founder cap', () => {
	test('one reward per league, capped per account', async () => {
		stub = stubVxpLedger();
		const userId = await createTestUser();

		expect(await grantLeagueFounderAward({ userId, leagueId: 'lg-a' })).toBe('paid');
		expect(await grantLeagueFounderAward({ userId, leagueId: 'lg-a' })).toBe('already');
		expect(stub.transfers).toHaveLength(1);
		expect(stub.transfers[0]?.amount).toBe(parseVxp(100));

		// Fill the account up to the cap; the next league pays nothing.
		await query(
			`insert into vxp_awards (user_id, award_type, award_key, amount_base_units, status, earned_at_ms)
			 select $1, 'league_founder', 'seed_' || g, $2, 'paid', 1 from generate_series(1, $3::int) g`,
			[userId, parseVxp(100).toString(), VXP_LEAGUE_FOUNDER_MAX_AWARDS]
		);

		expect(await grantLeagueFounderAward({ userId, leagueId: 'lg-b' })).toBe('capped');
		expect(stub.transfers).toHaveLength(1);
	});
});
