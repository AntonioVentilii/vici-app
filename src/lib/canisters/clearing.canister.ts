import {
	idlFactoryCertifiedClearing,
	idlFactoryClearing,
	type ClearingDid,
	type ClearingService
} from '$declarations';
import type { CreateCanisterOptions } from '$lib/types/canister';
import {
	Canister,
	createServices,
	fromNullable,
	jsonReplacer,
	type QueryParams
} from '@dfinity/utils';
import type { Principal } from '@icp-sdk/core/principal';

export class ClearingCanister extends Canister<ClearingService> {
	static create(options: CreateCanisterOptions<ClearingService>) {
		const { service, certifiedService, canisterId } = createServices<ClearingService>({
			options,
			idlFactory: idlFactoryClearing,
			certifiedIdlFactory: idlFactoryCertifiedClearing
		});

		return new ClearingCanister(canisterId, service, certifiedService);
	}

	depositCollateral = async ({
		params,
		...queryParams
	}: {
		params: ClearingDid.DepositCollateralParams;
	} & QueryParams): Promise<void> => {
		const { deposit_collateral } = this.caller(queryParams);
		const result = await deposit_collateral(params);

		if ('Ok' in result) {
			return;
		}

		throw new Error(`Failed to deposit collateral: ${JSON.stringify(result.Err, jsonReplacer)}`);
	};

	withdrawCollateral = async ({
		params,
		...queryParams
	}: {
		params: ClearingDid.WithdrawCollateralParams;
	} & QueryParams): Promise<void> => {
		const { withdraw_collateral } = this.caller(queryParams);
		const result = await withdraw_collateral(params);

		if ('Ok' in result) {
			return;
		}

		throw new Error(`Failed to withdraw collateral: ${JSON.stringify(result.Err, jsonReplacer)}`);
	};

	submitMatchedTrade = async ({
		params,
		...queryParams
	}: {
		params: ClearingDid.SubmitMatchedTradeParams;
	} & QueryParams): Promise<boolean> => {
		const { submit_matched_trade } = this.caller(queryParams);
		const result = await submit_matched_trade(params);

		if ('Ok' in result) {
			return result.Ok;
		}

		throw new Error(`Failed to submit matched trade: ${JSON.stringify(result.Err, jsonReplacer)}`);
	};

	getAccountState = async ({
		params,
		...queryParams
	}: {
		params: ClearingDid.GetAccountStateParams;
	} & QueryParams): Promise<ClearingDid.AccountStateResponse> => {
		const { get_account_state } = this.caller(queryParams);
		const result = await get_account_state(params);

		if ('Ok' in result) {
			return result.Ok;
		}

		throw new Error(`Failed to get account state: ${JSON.stringify(result.Err, jsonReplacer)}`);
	};

	getAccountStateQuery = async (
		queryParams: QueryParams
	): Promise<ClearingDid.AccountStateResponse> => {
		const { get_account_state_query } = this.caller(queryParams);
		const result = await get_account_state_query();

		if ('Ok' in result) {
			return result.Ok;
		}

		throw new Error(`Failed to query account state: ${JSON.stringify(result.Err, jsonReplacer)}`);
	};

	listCollateralAssets = async (
		queryParams: QueryParams
	): Promise<ClearingDid.CollateralAssetInfo[]> => {
		const { list_collateral_assets } = this.caller(queryParams);
		return await list_collateral_assets();
	};

	getPosition = async ({
		params,
		...queryParams
	}: {
		params: ClearingDid.GetPositionParams;
	} & QueryParams): Promise<ClearingDid.Position | undefined> => {
		const { get_position } = this.caller(queryParams);
		const result = await get_position(params);

		return fromNullable(result);
	};

	getPositions = async (queryParams: QueryParams): Promise<ClearingDid.Position[]> => {
		const { get_positions } = this.caller(queryParams);
		return await get_positions();
	};

	listSeries = async (queryParams: QueryParams): Promise<ClearingDid.Series[]> => {
		const { list_series } = this.caller(queryParams);
		return await list_series();
	};

	setRegistryCanister = async ({
		registryId,
		...queryParams
	}: {
		registryId: Principal;
	} & QueryParams): Promise<void> => {
		const { set_registry_canister } = this.caller(queryParams);
		return await set_registry_canister(registryId);
	};

	settleSeries = async ({
		params,
		...queryParams
	}: {
		params: ClearingDid.SettleSeriesParams;
	} & QueryParams): Promise<void> => {
		const { settle_series } = this.caller(queryParams);

		let result = await settle_series(params);

		while ('Processing' in result) {
			result = await settle_series(params);
		}

		if ('Ok' in result) {
			return;
		}

		throw new Error(`Failed to settle series: ${JSON.stringify(result.Err, jsonReplacer)}`);
	};

	acceptPositionTransfer = async ({
		proof,
		...queryParams
	}: {
		proof: ClearingDid.PositionProof;
	} & QueryParams): Promise<boolean> => {
		const { accept_position_transfer } = this.caller(queryParams);
		const result = await accept_position_transfer(proof);

		if ('Ok' in result) {
			return result.Ok;
		}

		throw new Error(
			`Failed to accept position transfer: ${JSON.stringify(result.Err, jsonReplacer)}`
		);
	};

	freezePositionForTransfer = async ({
		params,
		...queryParams
	}: {
		params: ClearingDid.FreezePositionForTransferParams;
	} & QueryParams): Promise<ClearingDid.PositionProof | undefined> => {
		const { freeze_position_for_transfer } = this.caller(queryParams);
		const result = await freeze_position_for_transfer(params);

		return fromNullable(result);
	};

	submitLimitOrder = async ({
		params
	}: {
		params: ClearingDid.SubmitLimitOrderParams;
	}): Promise<boolean> => {
		const { submit_limit_order } = this.caller({ certified: true });
		const result = await submit_limit_order(params);

		if ('Ok' in result) {
			return result.Ok;
		}

		throw new Error(`Failed to submit limit order: ${JSON.stringify(result.Err, jsonReplacer)}`);
	};

	submitMarketOrder = async ({
		params
	}: {
		params: ClearingDid.SubmitMarketOrderParams;
	}): Promise<boolean> => {
		const { submit_market_order } = this.caller({ certified: true });
		const result = await submit_market_order(params);

		if ('Ok' in result) {
			return result.Ok;
		}

		throw new Error(`Failed to submit market order: ${JSON.stringify(result.Err, jsonReplacer)}`);
	};

	cancelLimitOrder = async ({
		params
	}: {
		params: ClearingDid.CancelLimitOrderParams;
	}): Promise<boolean> => {
		const { cancel_limit_order } = this.caller({ certified: true });
		const result = await cancel_limit_order(params);

		if ('Ok' in result) {
			return result.Ok;
		}

		throw new Error(`Failed to cancel limit order: ${JSON.stringify(result.Err, jsonReplacer)}`);
	};

	getOrders = async (queryParams: QueryParams): Promise<ClearingDid.LimitOrder[]> => {
		const { get_orders } = this.caller(queryParams);
		return await get_orders();
	};

	listOrders = async ({
		params,
		...queryParams
	}: {
		params: ClearingDid.ListOrdersParams;
	} & QueryParams): Promise<ClearingDid.LimitOrder[]> => {
		const { list_orders } = this.caller(queryParams);
		return await list_orders(params);
	};

	getTradeHistory = async (queryParams: QueryParams): Promise<ClearingDid.Event[]> => {
		const { get_trade_history } = this.caller(queryParams);
		return await get_trade_history();
	};

	mintCompleteSet = async ({
		seriesId,
		qty,
		...queryParams
	}: {
		seriesId: string;
		qty: bigint;
	} & QueryParams): Promise<boolean> => {
		const { mint_complete_set } = this.caller(queryParams);
		const result = await mint_complete_set(seriesId, qty);

		if ('Ok' in result) {
			return result.Ok;
		}

		throw new Error(`Failed to mint complete set: ${JSON.stringify(result.Err, jsonReplacer)}`);
	};

	redeemCompleteSet = async ({
		seriesId,
		qty,
		...queryParams
	}: {
		seriesId: string;
		qty: bigint;
	} & QueryParams): Promise<boolean> => {
		const { redeem_complete_set } = this.caller(queryParams);
		const result = await redeem_complete_set(seriesId, qty);

		if ('Ok' in result) {
			return result.Ok;
		}

		throw new Error(`Failed to redeem complete set: ${JSON.stringify(result.Err, jsonReplacer)}`);
	};

	registerIcrcAsset = async ({
		params,
		...queryParams
	}: {
		params: ClearingDid.RegisterIcrcAssetParams;
	} & QueryParams): Promise<void> => {
		const { register_icrc_asset } = this.caller(queryParams);
		const result = await register_icrc_asset(params);

		if ('Ok' in result) {
			return;
		}

		throw new Error(`Failed to register ICRC asset: ${JSON.stringify(result.Err, jsonReplacer)}`);
	};
}
