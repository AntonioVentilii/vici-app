import type { ClearingDid } from '$declarations';
import { getAgent } from '$lib/actors/agents.ic';
import { ClearingCanister } from '$lib/canisters/clearing.canister';
import { CLEARING_CANISTER_ID } from '$lib/constants/canisters.constants';
import type { QueryParams } from '@dfinity/utils';
import type { Identity } from '@icp-sdk/core/agent';

export const depositCollateral = async ({
	identity,
	...rest
}: {
	identity: Identity;
	params: ClearingDid.DepositCollateralParams;
} & QueryParams): Promise<void> => {
	const { depositCollateral } = await clearingCanister({ identity });
	return await depositCollateral(rest);
};

export const withdrawCollateral = async ({
	identity,
	...rest
}: {
	identity: Identity;
	params: ClearingDid.WithdrawCollateralParams;
} & QueryParams): Promise<void> => {
	const { withdrawCollateral } = await clearingCanister({ identity });
	return await withdrawCollateral(rest);
};

export const submitMatchedTrade = async ({
	identity,
	...rest
}: {
	identity: Identity;
	params: ClearingDid.SubmitMatchedTradeParams;
} & QueryParams): Promise<boolean> => {
	const { submitMatchedTrade } = await clearingCanister({ identity });
	return await submitMatchedTrade(rest);
};

export const getAccountState = async ({
	identity,
	...rest
}: {
	identity: Identity;
	params: ClearingDid.GetAccountStateParams;
} & QueryParams): Promise<ClearingDid.AccountStateResponse> => {
	const { getAccountState } = await clearingCanister({ identity });
	return await getAccountState(rest);
};

export const getCollateralAssets = async ({
	identity,
	...queryParams
}: {
	identity: Identity;
} & QueryParams): Promise<ClearingDid.CollateralAssetInfo[]> => {
	const { getCollateralAssets } = await clearingCanister({ identity });
	return await getCollateralAssets(queryParams);
};

export const getPositions = async ({
	identity,
	...queryParams
}: {
	identity: Identity;
} & QueryParams): Promise<ClearingDid.Position[]> => {
	const { getPositions } = await clearingCanister({ identity });
	return await getPositions(queryParams);
};

export const settleSeries = async ({
	identity,
	...rest
}: {
	identity: Identity;
	params: ClearingDid.SettleSeriesParams;
} & QueryParams): Promise<void> => {
	const { settleSeries } = await clearingCanister({ identity });
	return await settleSeries(rest);
};

export const getPosition = async ({
	identity,
	...rest
}: {
	identity: Identity;
	params: ClearingDid.GetPositionParams;
} & QueryParams): Promise<ClearingDid.Position | undefined> => {
	const { getPosition } = await clearingCanister({ identity });
	return await getPosition(rest);
};

export const submitLimitOrder = async ({
	identity,
	params
}: {
	identity: Identity;
	params: ClearingDid.SubmitLimitOrderParams;
}): Promise<boolean> => {
	const { submitLimitOrder } = await clearingCanister({ identity });
	return await submitLimitOrder({ params });
};

export const submitMarketOrder = async ({
	identity,
	params
}: {
	identity: Identity;
	params: ClearingDid.SubmitMarketOrderParams;
}): Promise<boolean> => {
	const { submitMarketOrder } = await clearingCanister({ identity });
	return await submitMarketOrder({ params });
};

export const cancelLimitOrder = async ({
	identity,
	params
}: {
	identity: Identity;
	params: ClearingDid.CancelLimitOrderParams;
}): Promise<boolean> => {
	const { cancelLimitOrder } = await clearingCanister({ identity });
	return await cancelLimitOrder({ params });
};

export const getOrders = async ({
	identity,
	...queryParams
}: {
	identity: Identity;
} & QueryParams): Promise<ClearingDid.LimitOrder[]> => {
	const { getOrders } = await clearingCanister({ identity });
	return await getOrders(queryParams);
};

export const getTradeHistory = async ({
	identity,
	...queryParams
}: {
	identity: Identity;
} & QueryParams): Promise<ClearingDid.Event[]> => {
	const { getTradeHistory } = await clearingCanister({ identity });
	return await getTradeHistory(queryParams);
};

export const listOrders = async ({
	identity,
	...rest
}: {
	identity: Identity;
	params: ClearingDid.ListOrdersParams;
} & QueryParams): Promise<ClearingDid.LimitOrder[]> => {
	const { listOrders } = await clearingCanister({ identity });
	return await listOrders(rest);
};

export const mintCompleteSet = async ({
	identity,
	...rest
}: {
	identity: Identity;
	seriesId: string;
	qty: bigint;
} & QueryParams): Promise<boolean> => {
	const { mintCompleteSet } = await clearingCanister({ identity });
	return await mintCompleteSet(rest);
};

export const redeemCompleteSet = async ({
	identity,
	...rest
}: {
	identity: Identity;
	seriesId: string;
	qty: bigint;
} & QueryParams): Promise<boolean> => {
	const { redeemCompleteSet } = await clearingCanister({ identity });
	return await redeemCompleteSet(rest);
};

export const registerIcrcAsset = async ({
	identity,
	params,
	...queryParams
}: {
	identity: Identity;
	params: ClearingDid.RegisterIcrcAssetParams;
} & QueryParams): Promise<void> => {
	const { registerIcrcAsset } = await clearingCanister({ identity });
	return await registerIcrcAsset({ params, ...queryParams });
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
