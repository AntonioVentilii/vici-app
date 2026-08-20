import { describe, expect, test } from 'bun:test';
import { VXP_DECIMALS } from '../../src/vxp/constants';
import { extractStringConst, readRepoFile, readRepoSource } from '../helpers/repo-source';

// The IC asset seeds in 0003_custody.sql hardcode mainnet ledger canister ids
// that the app declares in canisters.constants.ts. The SQL is parsed with a
// narrow regex over the insert's value rows; the app constants module
// value-imports an IC SDK, so its ids are pinned by static extraction.
describe('shared drift: custody asset seeds', () => {
	const sql = readRepoFile('backend/src/db/migrations/0003_custody.sql').toString('utf8');
	const seeds = new Map(
		[...sql.matchAll(/\('ic',\s*'([^']+)',\s*(\d+),\s*'([^']+)',/g)].map((match) => [
			match[1],
			{ decimals: Number(match[2]), ledgerRef: match[3] }
		])
	);
	const canisters = readRepoSource('src/lib/constants/canisters.constants.ts');

	const APP_LEDGER_CONSTS: Record<string, string> = {
		VXP: 'VXP_LEDGER_CANISTER_ID_DEFAULT',
		ICP: 'ICP_LEDGER_CANISTER_ID',
		ckUSDC: 'CKUSDC_LEDGER_CANISTER_ID',
		ckBTC: 'CKBTC_LEDGER_CANISTER_ID',
		ckETH: 'CKETH_LEDGER_CANISTER_ID'
	};

	test('every seeded IC asset carries the ledger id the app declares', () => {
		expect([...seeds.keys()].sort()).toEqual(Object.keys(APP_LEDGER_CONSTS).sort());

		for (const [symbol, constName] of Object.entries(APP_LEDGER_CONSTS)) {
			expect(seeds.get(symbol)?.ledgerRef).toBe(
				extractStringConst({ source: canisters, constName })
			);
		}
	});

	test('the seeded VXP decimals match VXP_DECIMALS', () => {
		expect(seeds.get('VXP')?.decimals).toBe(VXP_DECIMALS);
	});
});
