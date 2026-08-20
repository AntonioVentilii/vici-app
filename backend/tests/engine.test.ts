// Engine client behavior with the actor mocked at the provider boundary:
// per-user signing identities, result unwrapping, cursor draining, and the
// public-read TTL cache.

import { toNullable } from '@dfinity/utils';
import type { Identity } from '@icp-sdk/core/agent';
import { afterEach, describe, expect, test } from 'bun:test';
import type { ClearingService, RegistryService } from '../src/declarations';
import { setEngineActorProvider } from '../src/engine/actors';
import { clearCache } from '../src/engine/cache';
import * as clearing from '../src/engine/clearing';
import * as registry from '../src/engine/registry';
import { userIcPrincipalText } from '../src/lib/keys';

const USER_A = '44444444-4444-4444-4444-444444444444';
const USER_B = '55555555-5555-5555-5555-555555555555';

let restore: (() => void) | undefined;

afterEach(() => {
	restore?.();
	restore = undefined;
	clearCache();
});

const mockProvider = ({
	clearing: clearingActor,
	registry: registryActor,
	onIdentity
}: {
	clearing?: Record<string, unknown>;
	registry?: Record<string, unknown>;
	onIdentity?: (identity: Identity) => void;
}): void => {
	restore = setEngineActorProvider({
		clearing: (identity) => {
			onIdentity?.(identity);

			return Promise.resolve((clearingActor ?? {}) as unknown as ClearingService);
		},
		registry: (identity) => {
			onIdentity?.(identity);

			return Promise.resolve((registryActor ?? {}) as unknown as RegistryService);
		}
	});
};

describe('per-user signing', () => {
	test('account calls sign with the derived custodial identity of the caller', async () => {
		const principals: string[] = [];

		mockProvider({
			clearing: { get_positions: () => Promise.resolve([]) },
			onIdentity: (identity) => principals.push(identity.getPrincipal().toText())
		});

		await clearing.getPositions({ userId: USER_A });
		await clearing.getPositions({ userId: USER_B });

		expect(principals).toEqual([userIcPrincipalText(USER_A), userIcPrincipalText(USER_B)]);
		expect(principals[0]).not.toBe(principals[1]);
	});

	test('public reads sign anonymously', async () => {
		const principals: string[] = [];

		mockProvider({
			clearing: { list_collateral_assets: () => Promise.resolve([]) },
			onIdentity: (identity) => principals.push(identity.getPrincipal().toText())
		});

		await clearing.listCollateralAssets();

		expect(principals).toEqual(['2vxsx-fae']);
	});
});

describe('result unwrapping', () => {
	test('Ok results unwrap, Err results throw with the encoded error', async () => {
		mockProvider({
			clearing: {
				submit_limit_order: () => Promise.resolve({ Ok: true }),
				cancel_limit_order: () => Promise.resolve({ Err: { OrderNotFound: null } })
			}
		});

		const params = {
			order_id: 'o1',
			series_id: 's1',
			outcome_id: toNullable<string>(),
			side: { Buy: null },
			qty: BigInt(1),
			price: {
				timestamp: toNullable<bigint>(),
				oracle_id: toNullable<string>(),
				decimal: { value: BigInt(50), decimals: 2 }
			}
		};

		expect(await clearing.submitLimitOrder({ userId: USER_A, params })).toBe(true);
		expect(
			clearing.cancelLimitOrder({ userId: USER_A, params: { order_id: 'nope' } })
		).rejects.toThrow('cancel_limit_order failed');
	});
});

describe('cursor draining', () => {
	test('listSettledSeries follows next_cursor to completion', async () => {
		const calls: unknown[] = [];

		mockProvider({
			clearing: {
				list_settled_series: (params: { start_after: [] | [string] }) => {
					calls.push(params.start_after);

					return Promise.resolve(
						params.start_after.length === 0
							? { items: ['s1', 's2'], next_cursor: toNullable('s2'), total: BigInt(3) }
							: { items: ['s3'], next_cursor: toNullable<string>(), total: BigInt(3) }
					);
				}
			}
		});

		expect(await clearing.listSettledSeries()).toEqual(['s1', 's2', 's3']);
		expect(calls).toHaveLength(2);
	});
});

describe('public read cache', () => {
	test('a second read inside the TTL never hits the actor', async () => {
		let loads = 0;

		mockProvider({
			registry: {
				get_series: () => {
					loads++;

					return Promise.resolve(toNullable());
				}
			}
		});

		await registry.getSeries('series-1');
		await registry.getSeries('series-1');

		expect(loads).toBe(1);

		// A different key loads independently.
		await registry.getSeries('series-2');

		expect(loads).toBe(2);
	});
});
