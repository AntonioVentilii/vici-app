import type { RegistryDid } from '$declarations';
import { addOracle, getOracle, manageOraclePrincipals } from '$lib/api/registry.api';
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

/**
 * Adds principals to the Vici oracle's authorized list.
 *
 * The caller must be the registry controller, the oracle manager, or an Engine
 * `OracleAdmin`. The principals granted here become allowed to settle markets
 * whose `oracle_source = VICI_ORACLE_V1` via `settle_series` on the clearing
 * canister.
 */
export const authorizeOraclePrincipals = async ({
	principals
}: {
	principals: PrincipalText[];
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	await manageOraclePrincipals({
		identity,
		params: {
			oracle_id: VICI_ORACLE_V1,
			add_principals: principals.map((p) => Principal.fromText(p)),
			remove_principals: []
		}
	});
};

/**
 * Removes principals from the Vici oracle's authorized list.
 */
export const revokeOraclePrincipals = async ({
	principals
}: {
	principals: PrincipalText[];
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	await manageOraclePrincipals({
		identity,
		params: {
			oracle_id: VICI_ORACLE_V1,
			add_principals: [],
			remove_principals: principals.map((p) => Principal.fromText(p))
		}
	});
};
