import {
	idlFactoryCertifiedRegistry,
	idlFactoryRegistry,
	type RegistryDid,
	type RegistryService
} from '$declarations';
import type { CreateCanisterOptions } from '$lib/types/canister';
import {
	Canister,
	createServices,
	jsonReplacer,
	type QueryParams,
	toNullable
} from '@dfinity/utils';

export class RegistryCanister extends Canister<RegistryService> {
	static create(options: CreateCanisterOptions<RegistryService>) {
		const { service, certifiedService, canisterId } = createServices<RegistryService>({
			options,
			idlFactory: idlFactoryRegistry,
			certifiedIdlFactory: idlFactoryCertifiedRegistry
		});

		return new RegistryCanister(canisterId, service, certifiedService);
	}

	addSeries = async ({
		params,
		...queryParams
	}: {
		params: RegistryDid.AddSeriesParams;
	} & QueryParams): Promise<string> => {
		const { add_series } = this.caller(queryParams);
		const result = await add_series(params);

		if ('Ok' in result) {
			return result.Ok;
		}

		throw new Error(`Failed to add series: ${JSON.stringify(result.Err, jsonReplacer)}`);
	};

	getSeries = async ({
		seriesId,
		...queryParams
	}: {
		seriesId: string;
	} & QueryParams): Promise<RegistryDid.Series | undefined> => {
		const { get_series } = this.caller(queryParams);
		const result = await get_series(seriesId);

		return result[0];
	};

	listSeries = async (queryParams: QueryParams): Promise<RegistryDid.Series[]> => {
		const { list_series } = this.caller(queryParams);

		const page = await list_series({
			cursor: toNullable(),
			limit: toNullable()
		} as RegistryDid.PaginationParams);

		const { items: series } = page;

		return series;
	};
}
