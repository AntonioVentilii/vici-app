import type { ClearingDid } from '$declarations';
import { getAgent } from '$lib/actors/agents.ic';
import { ClearingCanister } from '$lib/canisters/clearing.canister';
import { CLEARING_CANISTER_ID } from '$lib/constants/canisters.constants';
import type { QueryParams } from '@dfinity/utils';
import type { Identity } from '@icp-sdk/core/agent';

export const depositCollateral = async ({
	identity,
	params,
	...queryParams
}: {
	identity: Identity;
	params: ClearingDid.DepositCollateralParams;
} & QueryParams): Promise<void> => {
	const { depositCollateral } = await clearingCanister({ identity });
	return await depositCollateral({ params, ...queryParams });
};

export const withdrawCollateral = async ({
	identity,
	params,
	...queryParams
}: {
	identity: Identity;
	params: ClearingDid.WithdrawCollateralParams;
} & QueryParams): Promise<void> => {
	const { withdrawCollateral } = await clearingCanister({ identity });
	return await withdrawCollateral({ params, ...queryParams });
};

export const submitMatchedTrade = async ({
	identity,
	params,
	...queryParams
}: {
	identity: Identity;
	params: ClearingDid.SubmitMatchedTradeParams;
} & QueryParams): Promise<boolean> => {
	const { submitMatchedTrade } = await clearingCanister({ identity });
	return await submitMatchedTrade({ params, ...queryParams });
};

export const getMarginAccount = async ({
	identity,
	params,
	...queryParams
}: {
	identity: Identity;
	params: ClearingDid.GetMarginAccountParams;
} & QueryParams): Promise<ClearingDid.MarginAccount> => {
	const { getMarginAccount } = await clearingCanister({ identity });
	return await getMarginAccount({ params, ...queryParams });
};

export const getPositions = async ({
	identity,
	...queryParams
}: {
	identity: Identity;
} & QueryParams): Promise<[string, ClearingDid.Position][]> => {
	const { getPositions } = await clearingCanister({ identity });
	return await getPositions(queryParams);
};

export const settleSeries = async ({
	identity,
	params,
	...queryParams
}: {
	identity: Identity;
	params: ClearingDid.SettleSeriesParams;
} & QueryParams): Promise<void> => {
	const { settleSeries } = await clearingCanister({ identity });
	return await settleSeries({ params, ...queryParams });
};

const clearingCanister = async ({
	identity
}: {
	identity: Identity;
}): Promise<ClearingCanister> => {
	const agent = await getAgent({ identity });

	return ClearingCanister.create({
		agent,
		canisterId: CLEARING_CANISTER_ID
	});
};
