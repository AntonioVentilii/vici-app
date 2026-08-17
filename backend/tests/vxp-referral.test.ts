// Referral payout semantics: the diminishing referrer curve, the
// first-prediction settlement gate, both-sides idempotent settlement, and
// the trade-activity trigger composition.

import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { createActivity } from '../src/social/activities';
import { parseVxp, referrerRewardBaseUnits } from '../src/vxp/constants';
import { recordReferralRedemption, settleReferralPayout } from '../src/vxp/referral';
import { runTradeActivityTriggers } from '../src/vxp/triggers';
import { createTestUser, ensureMigrated } from './helpers/auth';
import { readAwardRow, stubVxpLedger, type LedgerStub } from './helpers/vxp';

let stub: LedgerStub | undefined;

beforeAll(async () => {
	await ensureMigrated();
});

afterEach(() => {
	stub?.restore();
	stub = undefined;
});

const recordTrade = async (userId: string): Promise<void> => {
	await createActivity({
		userId,
		type: 'trade',
		title: 'Prediction placed',
		timestamp: Date.now()
	});
};

describe('referrer reward curve', () => {
	test('the tier table pays 500 / 250 / 100 / 50 and zero past the cap', () => {
		expect(referrerRewardBaseUnits(0)).toBe(parseVxp(500));
		expect(referrerRewardBaseUnits(4)).toBe(parseVxp(500));
		expect(referrerRewardBaseUnits(5)).toBe(parseVxp(250));
		expect(referrerRewardBaseUnits(9)).toBe(parseVxp(250));
		expect(referrerRewardBaseUnits(10)).toBe(parseVxp(100));
		expect(referrerRewardBaseUnits(19)).toBe(parseVxp(100));
		expect(referrerRewardBaseUnits(20)).toBe(parseVxp(50));
		expect(referrerRewardBaseUnits(999)).toBe(parseVxp(50));
		expect(referrerRewardBaseUnits(1000)).toBe(BigInt(0));
	});
});

describe('settlement gates', () => {
	test('no referral row settles nothing', async () => {
		stub = stubVxpLedger();
		const userId = await createTestUser();

		expect(await settleReferralPayout({ refereeUserId: userId })).toEqual({
			settled: false,
			reason: 'no_referral'
		});
	});

	test('a redemption alone never pays: the referee must trade first', async () => {
		stub = stubVxpLedger();
		const referrer = await createTestUser();
		const referee = await createTestUser();

		await recordReferralRedemption({
			refereeUserId: referee,
			referrerUserId: referrer,
			code: 'CODE0001'
		});

		expect(await settleReferralPayout({ refereeUserId: referee })).toEqual({
			settled: false,
			reason: 'not_traded_yet'
		});
		expect(stub.transfers).toHaveLength(0);
	});
});

describe('both-sides settlement', () => {
	test('the first prediction settles the flat referee bonus and the tier-1 referrer reward, idempotently', async () => {
		stub = stubVxpLedger();
		const referrer = await createTestUser();
		const referee = await createTestUser();

		await recordReferralRedemption({
			refereeUserId: referee,
			referrerUserId: referrer,
			code: 'CODE0002'
		});
		await recordTrade(referee);

		expect(await settleReferralPayout({ refereeUserId: referee })).toEqual({ settled: true });

		const refereeAward = await readAwardRow({
			userId: referee,
			awardType: 'referral',
			awardKey: referee
		});
		const referrerAward = await readAwardRow({
			userId: referrer,
			awardType: 'referral',
			awardKey: referee
		});

		expect(refereeAward?.status).toBe('paid');
		expect(refereeAward?.amount_base_units).toBe(parseVxp(500).toString());
		expect(referrerAward?.status).toBe('paid');
		expect(referrerAward?.amount_base_units).toBe(parseVxp(500).toString());
		expect(stub.transfers).toHaveLength(2);

		// A retried settlement collides on both award keys.
		expect(await settleReferralPayout({ refereeUserId: referee })).toEqual({ settled: true });
		expect(stub.transfers).toHaveLength(2);
	});

	test('the referrer curve steps down with prior credited redemptions', async () => {
		stub = stubVxpLedger();
		const referrer = await createTestUser();

		// Five credited redemptions exhaust tier 1; the sixth pays 250.
		for (let i = 0; i < 6; i++) {
			const referee = await createTestUser();

			await recordReferralRedemption({
				refereeUserId: referee,
				referrerUserId: referrer,
				code: 'CODE0003',
				redeemedAtMs: 1000 + i
			});
			await recordTrade(referee);
			await settleReferralPayout({ refereeUserId: referee });
		}

		const referrerTransfers = stub.transfers.filter(({ memo }) => memo === 'vxp:referral:referrer');

		expect(referrerTransfers.map(({ amount }) => amount)).toEqual([
			parseVxp(500),
			parseVxp(500),
			parseVxp(500),
			parseVxp(500),
			parseVxp(500),
			parseVxp(250)
		]);
	});
});

describe('trade-activity trigger', () => {
	test('a trade activity drives the settlement; onboarding m2/m3 mint nothing at zero amounts', async () => {
		stub = stubVxpLedger();
		const referrer = await createTestUser();
		const referee = await createTestUser();

		await recordReferralRedemption({
			refereeUserId: referee,
			referrerUserId: referrer,
			code: 'CODE0004'
		});
		await recordTrade(referee);
		await runTradeActivityTriggers({ userId: referee });

		expect(
			(await readAwardRow({ userId: referee, awardType: 'referral', awardKey: referee }))?.status
		).toBe('paid');

		// m2 is owed at the first trade but its configured amount is zero, so no
		// award row exists.
		expect(
			await readAwardRow({ userId: referee, awardType: 'onboarding', awardKey: 'm2' })
		).toBeUndefined();
	});
});
