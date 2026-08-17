// Adapter registry gating: ic is enabled with zero configuration, the other
// chains register as disabled until their env lands, and disabled adapters
// fail closed (still deriving addresses, since derivation is pure).

import { describe, expect, test } from 'bun:test';
import { enabledAdapters, getAdapter, isChain, listAdapters } from '../src/chains/registry';
import { ChainDisabledError } from '../src/chains/types';
import type { Asset } from '../src/custody/assets';
import { loadEnv } from '../src/env';

const USER = '33333333-3333-3333-3333-333333333333';

const fakeAsset: Asset = {
	id: 'asset-id',
	chain: 'evm',
	symbol: 'ETH',
	decimals: 18,
	ledger_ref: null,
	enabled: true
};

describe('adapter registry (test env has no chain config)', () => {
	test('registers all four chains', () => {
		expect(
			listAdapters()
				.map((adapter) => adapter.chain)
				.sort()
		).toEqual(['btc', 'evm', 'ic', 'sol']);
	});

	test('ic is enabled by default, the rest are disabled', () => {
		expect(getAdapter('ic').enabled).toBe(true);
		expect(getAdapter('evm').enabled).toBe(false);
		expect(getAdapter('sol').enabled).toBe(false);
		expect(getAdapter('btc').enabled).toBe(false);
		expect(enabledAdapters().map((adapter) => adapter.chain)).toEqual(['ic']);
	});

	test('disabled adapters reject I/O with ChainDisabledError', () => {
		for (const chain of ['evm', 'sol', 'btc'] as const) {
			const adapter = getAdapter(chain);

			expect(adapter.getBalance({ address: 'x', asset: fakeAsset })).rejects.toThrow(
				ChainDisabledError
			);
			expect(adapter.transfer({ to: 'x', amount: BigInt(1), asset: fakeAsset })).rejects.toThrow(
				ChainDisabledError
			);
		}
	});

	test('disabled adapters still derive addresses (pure, no I/O)', () => {
		expect(getAdapter('evm').deriveAddress(USER).startsWith('0x')).toBe(true);
		expect(getAdapter('btc').deriveAddress(USER).startsWith('bc1q')).toBe(true);
		expect(getAdapter('sol').deriveAddress(USER).length).toBeGreaterThan(30);
		expect(getAdapter('ic').deriveAddress(USER)).toContain('-');
	});

	test('isChain narrows correctly', () => {
		expect(isChain('ic')).toBe(true);
		expect(isChain('evm')).toBe(true);
		expect(isChain('dogecoin')).toBe(false);
	});
});

describe('chain env gating', () => {
	test('evm/sol/btc flip enabled with their env vars', () => {
		const env = loadEnv({
			EVM_RPC_URL: 'https://rpc.example',
			SOL_RPC_URL: 'https://sol.example',
			BTC_ESPLORA_URL: 'https://esplora.example'
		});

		expect(env.evm.enabled).toBe(true);
		expect(env.sol.enabled).toBe(true);
		expect(env.btc.enabled).toBe(true);
	});

	test('defaults keep them off and pin ic to mainnet', () => {
		const env = loadEnv({});

		expect(env.evm.enabled).toBe(false);
		expect(env.sol.enabled).toBe(false);
		expect(env.btc.enabled).toBe(false);
		expect(env.ic.host).toBe('https://icp-api.io');
	});

	test('rejects an unknown BTC_NETWORK', () => {
		expect(() => loadEnv({ BTC_NETWORK: 'mainnet2' })).toThrow('BTC_NETWORK');
	});

	test('parses the custody asset allowlist', () => {
		expect(loadEnv({}).custodyEnabledAssets).toBeNull();
		expect(loadEnv({ CUSTODY_ENABLED_ASSETS: 'VXP, ICP,evm:USDC' }).custodyEnabledAssets).toEqual([
			'VXP',
			'ICP',
			'evm:USDC'
		]);
	});
});
