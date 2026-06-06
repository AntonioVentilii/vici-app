import { idlFactoryRegistry, type RegistryDid } from '$declarations';
import { REGISTRY_CANISTER_ID } from '$lib/constants/canisters.constants';
import { Collection } from '$lib/constants/collections.constants';
import { normalizeMarketTags } from '$lib/constants/market-tags.constants';
import type { MarketMetadata, MarketMetadataInput } from '$lib/types/market-metadata';
import { isAdmin } from '$satellite/services/_authz';
import { callArgs, callResultType } from '$satellite/utils/canister-call.utils';
import { isNullish } from '@dfinity/utils';
import { call, msgCaller, time } from '@junobuild/functions/ic-cdk';
import { decodeDocData, encodeDocData, getDocStore, setDocStore } from '@junobuild/functions/sdk';

const callerText = (): string => msgCaller().toText();

const getSeriesCreator = async (seriesId: string): Promise<string | undefined> => {
	const result = await call<[] | [RegistryDid.Series]>({
		canisterId: REGISTRY_CANISTER_ID,
		method: 'get_series',
		args: callArgs({ idlFactory: idlFactoryRegistry, method: 'get_series', values: [seriesId] }),
		result: callResultType({ idlFactory: idlFactoryRegistry, method: 'get_series' })
	});

	return result[0]?.creator.toText();
};

const assertCanWriteMarketMetadata = async ({ seriesId }: { seriesId: string }): Promise<void> => {
	const caller = msgCaller();
	const text = caller.toText();

	if (isAdmin({ caller })) {
		return;
	}

	const creator = await getSeriesCreator(seriesId);

	if (creator === text) {
		return;
	}

	throw new Error('Only the market creator or an admin can edit market metadata.');
};

export const getMarketMetadata = ({
	seriesId
}: {
	seriesId: string;
}): MarketMetadata | undefined => {
	const doc = getDocStore({
		collection: Collection.MARKET_METADATA,
		key: seriesId,
		caller: msgCaller()
	});

	return isNullish(doc) ? undefined : decodeDocData<MarketMetadata>(doc.data);
};

export const upsertMarketMetadata = async ({
	seriesId,
	data
}: {
	seriesId: string;
	data: MarketMetadataInput;
}): Promise<MarketMetadata> => {
	if ((data.events ?? []).length > 2) {
		throw new Error('Market metadata supports at most two events.');
	}

	await assertCanWriteMarketMetadata({ seriesId });

	const caller = msgCaller();
	const callerIsAdmin = isAdmin({ caller });
	const current = getDocStore({
		collection: Collection.MARKET_METADATA,
		key: seriesId,
		caller
	});

	const currentData = isNullish(current) ? undefined : decodeDocData<MarketMetadata>(current.data);

	// `suggested` is admin-only: creators can edit whyNow/events but can't
	// flip the suggested flag. Non-admin writers always keep the stored value.
	const suggested = callerIsAdmin ? (data.suggested ?? false) : (currentData?.suggested ?? false);

	const metadata: MarketMetadata = {
		seriesId,
		whyNow: data.whyNow,
		events: data.events ?? [],
		tags: normalizeMarketTags(data.tags ?? []),
		suggested,
		subtitle: data.subtitle,
		updatedAt: Number(time() / 1_000_000n),
		updatedBy: callerText()
	};

	setDocStore({
		collection: Collection.MARKET_METADATA,
		key: seriesId,
		doc: {
			version: current?.version,
			data: encodeDocData(metadata)
		},
		caller
	});

	return metadata;
};
