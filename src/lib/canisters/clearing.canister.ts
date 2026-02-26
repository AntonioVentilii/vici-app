import {
	idlFactoryCertifiedClearing,
	idlFactoryClearing,
	type ClearingDid,
	type ClearingService
} from '$declarations';
import type { CreateCanisterOptions } from '$lib/types/canister';
import { Canister, createServices, type QueryParams } from '@dfinity/utils';
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

		throw new Error(`Failed to deposit collateral: ${JSON.stringify(result.Err)}`);
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

		throw new Error(`Failed to withdraw collateral: ${JSON.stringify(result.Err)}`);
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

		throw new Error(`Failed to submit matched trade: ${JSON.stringify(result.Err)}`);
	};

	getMarginAccount = async ({
		params,
		...queryParams
	}: {
		params: ClearingDid.GetMarginAccountParams;
	} & QueryParams): Promise<ClearingDid.MarginAccount> => {
		const { get_margin_account } = this.caller(queryParams);
		const result = await get_margin_account(params);

		if ('Ok' in result) {
			return result.Ok;
		}

		throw new Error(`Failed to get margin account: ${JSON.stringify(result.Err)}`);
	};

	getMarginAccountQuery = async (queryParams: QueryParams): Promise<ClearingDid.MarginAccount> => {
		const { get_margin_account_query } = this.caller(queryParams);
		const result = await get_margin_account_query();

		if ('Ok' in result) {
			return result.Ok;
		}

		throw new Error(`Failed to query margin account: ${JSON.stringify(result.Err)}`);
	};

	getPosition = async ({
		params,
		...queryParams
	}: {
		params: ClearingDid.GetPositionParams;
	} & QueryParams): Promise<ClearingDid.Position | undefined> => {
		const { get_position } = this.caller(queryParams);
		const result = await get_position(params);

		return result[0];
	};

	getPositions = async (queryParams: QueryParams): Promise<[string, ClearingDid.Position][]> => {
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
		const result = await settle_series(params);

		if ('Ok' in result) {
			return;
		}

		throw new Error(`Failed to settle series: ${JSON.stringify(result.Err)}`);
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

		throw new Error(`Failed to accept position transfer: ${JSON.stringify(result.Err)}`);
	};

	freezePositionForTransfer = async ({
		params,
		...queryParams
	}: {
		params: ClearingDid.FreezePositionForTransferParams;
	} & QueryParams): Promise<ClearingDid.PositionProof | undefined> => {
		const { freeze_position_for_transfer } = this.caller(queryParams);
		const result = await freeze_position_for_transfer(params);

		return result[0];
	};
}
