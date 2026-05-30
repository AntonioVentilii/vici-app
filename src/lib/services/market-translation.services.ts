import { functions } from '$declarations/satellite/satellite.api';
import type { AppLocale } from '$lib/constants/locale.constants';
import type { MarketTranslation, MarketTranslationInput } from '$lib/types/market-translation';
import { fromWireMarketTranslation } from '$satellite/utils/wire-format.utils';

export const getMarketTranslation = async ({
	seriesId,
	locale
}: {
	seriesId: string;
	locale: AppLocale;
}): Promise<MarketTranslation | undefined> => {
	const { translation } = await functions.getMarketTranslation({ seriesId, locale });

	return translation;
};

export const listMarketTranslations = async (seriesId: string): Promise<MarketTranslation[]> => {
	const { items } = await functions.listMarketTranslations({ seriesId });

	return items.map(fromWireMarketTranslation);
};

export const upsertMarketTranslation = async ({
	seriesId,
	locale,
	data
}: {
	seriesId: string;
	locale: AppLocale;
	data: MarketTranslationInput;
}): Promise<MarketTranslation> => {
	const { translation } = await functions.upsertMarketTranslation({ seriesId, locale, data });

	return translation;
};
