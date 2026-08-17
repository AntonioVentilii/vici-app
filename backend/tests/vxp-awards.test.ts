// Award-core semantics: structural idempotency, the pending/paid/failed
// lifecycle, the BadFee single retry, record-only mode with reconciliation,
// and the analytics bridge on the pending-to-paid transition.

import { IcrcTransferError } from '@icp-sdk/canisters/ledger/icrc';
import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { query } from '../src/db/client';
import { grantAward, reconcileUnpaidAwards, setVxpTreasuryDisabled } from '../src/vxp/awards';
import { parseVxp } from '../src/vxp/constants';
import { createTestUser, ensureMigrated } from './helpers/auth';
import { readAwardRow, stubVxpLedger, type LedgerStub } from './helpers/vxp';

let stub: LedgerStub | undefined;
let restoreMode: (() => void) | undefined;

beforeAll(async () => {
	await ensureMigrated();
});

afterEach(() => {
	stub?.restore();
	stub = undefined;
	restoreMode?.();
	restoreMode = undefined;
});

const awardEvents = async (userId: string): Promise<Array<{ name: string; props: unknown }>> =>
	await query<{ name: string; props: unknown }>(
		`select name, props from analytics_events where user_id = $1 order by key`,
		[userId]
	);

describe('grant idempotency', () => {
	test('a duplicate trigger produces exactly one award and one transfer', async () => {
		stub = stubVxpLedger();
		const userId = await createTestUser();

		const first = await grantAward({
			userId,
			awardType: 'streak',
			awardKey: 'streak_3',
			amountBaseUnits: parseVxp(50)
		});
		const second = await grantAward({
			userId,
			awardType: 'streak',
			awardKey: 'streak_3',
			amountBaseUnits: parseVxp(50)
		});

		expect(first.outcome).toBe('paid');
		expect(second.outcome).toBe('already');
		expect(stub.transfers).toHaveLength(1);

		const rows = await query<{ count: string }>(
			`select count(*)::text as count from vxp_awards where user_id = $1`,
			[userId]
		);

		expect(Number(rows[0]?.count)).toBe(1);
	});

	test('non-positive amounts are skipped entirely, nothing is owed', async () => {
		stub = stubVxpLedger();
		const userId = await createTestUser();

		const outcome = await grantAward({
			userId,
			awardType: 'onboarding',
			awardKey: 'm2',
			amountBaseUnits: BigInt(0)
		});

		expect(outcome.outcome).toBe('skipped_zero');
		expect(stub.transfers).toHaveLength(0);
		expect(await readAwardRow({ userId, awardType: 'onboarding', awardKey: 'm2' })).toBeUndefined();
	});
});

describe('transfer lifecycle', () => {
	test('a successful transfer lands as paid with the block index', async () => {
		stub = stubVxpLedger({ transferImpl: () => Promise.resolve(BigInt(42)) });
		const userId = await createTestUser();

		const outcome = await grantAward({
			userId,
			awardType: 'achievement',
			awardKey: 'oracle',
			amountBaseUnits: parseVxp(500),
			memo: 'vxp:achievement:oracle'
		});

		expect(outcome).toEqual({ outcome: 'paid', blockIndex: '42' });

		const row = await readAwardRow({ userId, awardType: 'achievement', awardKey: 'oracle' });

		expect(row?.status).toBe('paid');
		expect(row?.block_index).toBe('42');
		expect(stub.transfers[0]?.memo).toBe('vxp:achievement:oracle');
		expect(stub.transfers[0]?.amount).toBe(parseVxp(500));
	});

	test('BadFee is retried once with the ledger-reported expected fee', async () => {
		stub = stubVxpLedger({
			transferImpl: (call, index) => {
				if (index === 0) {
					return Promise.reject(
						new IcrcTransferError({
							msg: 'bad fee',
							errorType: { BadFee: { expected_fee: BigInt(10) } }
						})
					);
				}

				return Promise.resolve(BigInt(7));
			}
		});
		const userId = await createTestUser();

		const outcome = await grantAward({
			userId,
			awardType: 'streak',
			awardKey: 'streak_7',
			amountBaseUnits: parseVxp(150)
		});

		expect(outcome).toEqual({ outcome: 'paid', blockIndex: '7' });
		expect(stub.transfers).toHaveLength(2);
		expect(stub.transfers[0]?.fee).toBeUndefined();
		expect(stub.transfers[1]?.fee).toBe(BigInt(10));
	});

	test('a non-BadFee rejection is terminal: failed with the error recorded', async () => {
		stub = stubVxpLedger({
			transferImpl: () =>
				Promise.reject(
					new IcrcTransferError({
						msg: 'insufficient',
						errorType: { InsufficientFunds: { balance: BigInt(3) } }
					})
				)
		});
		const userId = await createTestUser();

		const outcome = await grantAward({
			userId,
			awardType: 'comeback',
			awardKey: 'restore',
			amountBaseUnits: parseVxp(250)
		});

		expect(outcome.outcome).toBe('failed');
		expect(stub.transfers).toHaveLength(1);

		const row = await readAwardRow({ userId, awardType: 'comeback', awardKey: 'restore' });

		expect(row?.status).toBe('failed');
		expect(row?.error_message).toContain('InsufficientFunds');
	});
});

describe('record-only mode + reconciliation', () => {
	test('awards are recorded pending without a transfer, then paid by reconciliation', async () => {
		stub = stubVxpLedger();
		restoreMode = setVxpTreasuryDisabled(true);
		const userId = await createTestUser();

		const outcome = await grantAward({
			userId,
			awardType: 'streak',
			awardKey: 'streak_14',
			amountBaseUnits: parseVxp(400)
		});

		expect(outcome.outcome).toBe('recorded');
		expect(stub.transfers).toHaveLength(0);
		expect(
			(await readAwardRow({ userId, awardType: 'streak', awardKey: 'streak_14' }))?.status
		).toBe('pending');

		// Reconciliation is a no-op while record-only mode stays on.
		expect(await reconcileUnpaidAwards({ graceMs: 0 })).toEqual({
			scanned: 0,
			paid: 0,
			failed: 0
		});

		// Treasury back on: the sweep pays the recorded award.
		restoreMode();
		restoreMode = setVxpTreasuryDisabled(false);

		const report = await reconcileUnpaidAwards({ graceMs: 0 });

		expect(report.paid).toBeGreaterThanOrEqual(1);
		expect(stub.transfers.length).toBeGreaterThanOrEqual(1);
		expect(
			(await readAwardRow({ userId, awardType: 'streak', awardKey: 'streak_14' }))?.status
		).toBe('paid');
	});
});

describe('analytics bridge', () => {
	test('the pending-to-paid transition emits vxp_awarded, and streak_milestone for streaks', async () => {
		stub = stubVxpLedger();
		const userId = await createTestUser();

		await grantAward({
			userId,
			awardType: 'streak',
			awardKey: 'streak_7',
			amountBaseUnits: parseVxp(150)
		});

		const events = await awardEvents(userId);
		const names = events.map(({ name }) => name);

		expect(names).toContain('vxp_awarded');
		expect(names).toContain('streak_milestone');

		const awarded = events.find(({ name }) => name === 'vxp_awarded')?.props as {
			value: number;
			label: string;
		};
		const milestone = events.find(({ name }) => name === 'streak_milestone')?.props as {
			step: number;
		};

		expect(awarded).toEqual({ value: 150, label: 'streak' });
		expect(milestone).toEqual({ step: 7 });
	});

	test('a recorded (unpaid) award emits nothing until reconciliation pays it', async () => {
		stub = stubVxpLedger();
		restoreMode = setVxpTreasuryDisabled(true);
		const userId = await createTestUser();

		await grantAward({
			userId,
			awardType: 'flow_overtime',
			awardKey: '2026-08-17',
			amountBaseUnits: parseVxp(25)
		});

		expect(await awardEvents(userId)).toHaveLength(0);

		restoreMode();
		restoreMode = setVxpTreasuryDisabled(false);
		await reconcileUnpaidAwards({ graceMs: 0 });

		const events = await awardEvents(userId);

		expect(events.map(({ name }) => name)).toContain('vxp_awarded');
	});
});
