import type { RegistryDid } from '$declarations';
import { REGISTRY_CANISTER_ID } from '$lib/constants/canisters.constants';
import { Collection } from '$lib/constants/collections.constants';
import { normalizeMarketTags } from '$lib/constants/market-tags.constants';
import type { MarketMetadata, MarketMetadataInput } from '$lib/types/market-metadata';
import { isAdmin } from '$satellite/services/_authz';
import { isNullish } from '@dfinity/utils';
import { IDL } from '@icp-sdk/core/candid';
import { call, msgCaller, time } from '@junobuild/functions/ic-cdk';
import { decodeDocData, encodeDocData, getDocStore, setDocStore } from '@junobuild/functions/sdk';

const DescriptionIdl = IDL.Record({
	html: IDL.Opt(IDL.Text),
	markdown: IDL.Opt(IDL.Text),
	plain: IDL.Text
});
const DecimalValueIdl = IDL.Record({ decimals: IDL.Nat8, value: IDL.Nat });
const PriceIdl = IDL.Record({
	timestamp: IDL.Opt(IDL.Nat64),
	oracle_id: IDL.Opt(IDL.Text),
	decimal: DecimalValueIdl
});
const PayoffTypeIdl = IDL.Variant({
	Put: IDL.Null,
	Binary: IDL.Null,
	Call: IDL.Null,
	Categorical: IDL.Null
});
const FiatUnitIdl = IDL.Variant({
	Chf: IDL.Null,
	Eur: IDL.Null,
	Gbp: IDL.Null,
	Usd: IDL.Null
});
const ErcTokenIdl = IDL.Record({
	decimals: IDL.Nat8,
	token_address: IDL.Text,
	chain_id: IDL.Nat64
});
const NativeEvmAssetIdl = IDL.Record({
	decimals: IDL.Nat8,
	chain_id: IDL.Nat64
});
const AssetIdl = IDL.Variant({
	Erc20: ErcTokenIdl,
	Icrc: IDL.Principal,
	NativeEvm: NativeEvmAssetIdl
});
const SocialRewardIdl = IDL.Record({
	title: IDL.Text,
	description: IDL.Opt(IDL.Text),
	icon_url: IDL.Opt(IDL.Text)
});
const NonMonetaryUnitIdl = IDL.Variant({
	Points: IDL.Null,
	Social: SocialRewardIdl
});
const PayoutUnitIdl = IDL.Variant({
	Fiat: FiatUnitIdl,
	Asset: AssetIdl,
	NonMonetary: NonMonetaryUnitIdl
});
const OutcomeIdl = IDL.Record({
	id: IDL.Text,
	title: IDL.Text,
	description: IDL.Opt(DescriptionIdl),
	icon_url: IDL.Opt(IDL.Text)
});
const TradingAccessIdl = IDL.Variant({
	Open: IDL.Null,
	Restricted: IDL.Record({ groups: IDL.Vec(IDL.Text) })
});
const BalanceDomainIdl = IDL.Variant({
	ViciXp: IDL.Null,
	Social: IDL.Null,
	Playground: IDL.Null,
	Settlement: IDL.Null
});
const SeriesIdl = IDL.Record({
	title: IDL.Text,
	strike: IDL.Opt(PriceIdl),
	creator: IDL.Principal,
	payoff_type: PayoffTypeIdl,
	engine_id: IDL.Opt(IDL.Text),
	payout_unit: PayoutUnitIdl,
	expiry_ns: IDL.Nat64,
	banner_url: IDL.Opt(IDL.Text),
	series_id: IDL.Text,
	underlying: IDL.Text,
	description: DescriptionIdl,
	outcomes: IDL.Opt(IDL.Vec(OutcomeIdl)),
	created_at_ns: IDL.Nat64,
	icon_url: IDL.Opt(IDL.Text),
	trading_access: IDL.Vec(TradingAccessIdl),
	price_precision: IDL.Nat8,
	balance_domain: BalanceDomainIdl,
	oracle_source: IDL.Text,
	forked_from: IDL.Opt(IDL.Text)
});

const callerText = (): string => msgCaller().toText();

const getSeriesCreator = async (seriesId: string): Promise<string | undefined> => {
	const result = await call<[] | [RegistryDid.Series]>({
		canisterId: REGISTRY_CANISTER_ID,
		method: 'get_series',
		args: [[IDL.Text, seriesId]],
		result: IDL.Opt(SeriesIdl)
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
