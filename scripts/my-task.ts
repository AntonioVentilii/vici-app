import { AgentManager } from '@dfinity/utils';
import { IcManagementCanister } from '@icp-sdk/canisters/ic-management';
import { IDL } from '@icp-sdk/core/candid';
import { Principal } from '@icp-sdk/core/principal';
import { upgradeModule } from '@junobuild/admin';
import { defineRun } from '@junobuild/config';
import { readFileSync } from 'node:fs';

export const onRun = defineRun(({ mode, profile }) => ({
	run: async ({ satelliteId, identity, container }) => {
		console.log('Running task with:', {
			mode,
			profile,
			satelliteId: satelliteId.toText(),
			whoami: identity.getPrincipal().toText(),
			container
		});

		const { getAgent } = AgentManager.create({
			fetchRootKey: mode === 'development',
			host: container
		});

		const agent = await getAgent({ identity });

		console.log({ agent });

		const { provisionalCreateCanisterWithCycles, canisterStatus } = IcManagementCanister.create({
			agent
		});

		const testCanisterId = Principal.from('2ipq2-uqaaa-aaaar-qailq-cai');

		const status = await canisterStatus({ canisterId: testCanisterId });

		console.log({ status });

		const wasmModule = readFileSync('./target/icdc/registry.wasm');

		await upgradeModule({
			actor: {
				agent,
				identity
			},
			mode: { reinstall: null },
			canisterId: testCanisterId,
			wasmModule,
			arg: IDL.encode([], []),
			takeSnapshot: false
		});

		// const canisterId = await provisionalCreateCanisterWithCycles({
		// 	settings: {
		// 		controllers: toNullable(identity.getPrincipal().toText())
		// 	},
		// 	canisterId: Principal.from('2ipq2-uqaaa-aaaar-qailq-cai')
		// });
	}
}));
