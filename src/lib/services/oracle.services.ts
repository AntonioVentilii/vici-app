import type { RegistryDid } from '$declarations';
import { addOracle, getOracle } from '$lib/api/registry.api';
import { VICI_ORACLE_V1 } from '$lib/constants/app.constants';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import { Principal } from '@icp-sdk/core/principal';
import type { PrincipalText } from '@junobuild/schema';

/**
 * Fetches the canonical Vici oracle registration (if any).
 *
 * Returns `undefined` when the oracle has not been registered yet, in which
 * case the admin must call {@link registerViciOracle} to create it.
 */
export const getViciOracle = async (): Promise<RegistryDid.Oracle | undefined> => {
	const identity = await safeGetIdentityOnce();

	return await getOracle({ identity, oracleId: VICI_ORACLE_V1 });
};

/**
 * Registers the Vici oracle with an initial list of authorized principals.
 *
 * Only controllers or Engine `OracleAdmin` role holders on the registry can
 * call this successfully.
 */
export const registerViciOracle = async ({
	authorizedPrincipals
}: {
	authorizedPrincipals: PrincipalText[];
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	const params: RegistryDid.AddOracleParams = {
		oracle_id: VICI_ORACLE_V1,
		metadata: {
			name: 'Vici Oracle v1',
			description: [
				{
					plain: 'Default settlement oracle for Vici prediction markets',
					markdown: [],
					html: []
				}
			],
			website: []
		},
		authorized_principals: authorizedPrincipals.map((p) => Principal.fromText(p))
	};

	await addOracle({ identity, params });
};

// Note: direct add/remove of oracle settlers used to live here. It is now driven
// automatically by the `syncRoleToEngine` satellite hook (see
// `src/satellite/services/engine-sync.services.ts`) — assigning the `ADMIN` or
// `SOLVER` role to a user both grants them `OracleAdmin` on the Vici engine and
// adds them to `VICI_ORACLE_V1.authorized_principals`. For manual reconciliation,
// see `.agents/workflows/icdc-engine-operations.md`.
