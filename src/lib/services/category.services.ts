import { Collection } from '$lib/constants/collections.constants';
import type { Category, SeriesCategory } from '$lib/types/category';
import { getDoc, listDocs, setDoc } from '@junobuild/core';
import type { PrincipalText } from '@junobuild/schema';

/** Stores a series→category mapping (keyed by series id). */
export const associateSeriesWithCategory = async ({
	seriesId,
	categoryId,
	adminPrincipal
}: {
	seriesId: string;
	categoryId: string;
	adminPrincipal: PrincipalText;
}): Promise<void> => {
	const mapping: SeriesCategory = {
		seriesId,
		categoryId,
		associatedAt: Date.now(),
		associatedBy: adminPrincipal
	};

	await setDoc({
		collection: Collection.SERIES_CATEGORIES,
		doc: {
			key: `${seriesId}-${categoryId}`,
			data: mapping
		}
	});
};

/** Returns the category mapping for a series, if any. */
export const getSeriesCategory = async (seriesId: string): Promise<SeriesCategory | undefined> => {
	const doc = await getDoc<SeriesCategory>({
		collection: Collection.SERIES_CATEGORIES,
		key: seriesId
	});

	return doc?.data;
};

/** All taxonomy categories from Juno. */
export const listCategories = async (): Promise<Category[]> => {
	const { items } = await listDocs<Category>({
		collection: Collection.CATEGORIES
	});

	return items.map(({ data }) => data);
};

/** All series–category associations. */
export const listSeriesCategories = async (): Promise<SeriesCategory[]> => {
	const { items } = await listDocs<SeriesCategory>({
		collection: Collection.SERIES_CATEGORIES
	});

	return items.map(({ data }) => data);
};
