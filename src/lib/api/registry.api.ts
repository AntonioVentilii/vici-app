import type { RegistryDid } from '$declarations';
import { getAgent } from '$lib/actors/agents.ic';
import { RegistryCanister } from '$lib/canisters/registry.canister';
import { REGISTRY_CANISTER_ID } from '$lib/constants/canisters.constants';
import type { QueryParams } from '@dfinity/utils';
import type { Identity } from '@icp-sdk/core/agent';

export const addSeries = async ({
	identity,
	params,
	...queryParams
}: {
	identity: Identity;
	params: RegistryDid.AddSeriesParams;
} & QueryParams): Promise<string> => {
	const { addSeries } = await registryCanister({ identity });
	return await addSeries({ params, ...queryParams });
};

export const getSeries = async ({
	identity,
	seriesId,
	...queryParams
}: {
	identity: Identity;
	seriesId: string;
} & QueryParams): Promise<RegistryDid.Series | undefined> => {
	const { getSeries } = await registryCanister({ identity });
	return await getSeries({ seriesId, ...queryParams });
};

export const listSeries = async ({
	identity,
	...queryParams
}: {
	identity: Identity;
} & QueryParams): Promise<RegistryDid.Series[]> => {
	const { listSeries } = await registryCanister({ identity });
	return await listSeries(queryParams);
};

const registryCanister = async ({
	identity
}: {
	identity: Identity;
}): Promise<RegistryCanister> => {
	const agent = await getAgent({ identity });

	return RegistryCanister.create({
		agent,
		canisterId: REGISTRY_CANISTER_ID
	});
};
