import { functions } from '$declarations/satellite/satellite.api';
import type { MarketMetadata, MarketMetadataInput } from '$lib/types/market-metadata';

export const getMarketMetadata = async (seriesId: string): Promise<MarketMetadata | undefined> => {
	const { metadata } = await functions.getMarketMetadata({ seriesId });

	return metadata;
};

export const upsertMarketMetadata = async ({
	seriesId,
	data
}: {
	seriesId: string;
	data: MarketMetadataInput;
}): Promise<MarketMetadata> => {
	const { metadata } = await functions.upsertMarketMetadata({ seriesId, data });

	return metadata;
};
