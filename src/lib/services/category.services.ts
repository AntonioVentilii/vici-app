import { Collection } from '$lib/constants/collections.constants';
import type { Category, SeriesCategory } from '$lib/types/category';
import type { PrincipalText } from '@dfinity/zod-schemas';
import { getDoc, listDocs, setDoc } from '@junobuild/core';

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
			key: seriesId, // Use seriesId as key for easy lookup
			data: mapping
		}
	});
};

export const getSeriesCategory = async (seriesId: string): Promise<SeriesCategory | undefined> => {
	const doc = await getDoc<SeriesCategory>({
		collection: Collection.SERIES_CATEGORIES,
		key: seriesId
	});
	return doc?.data;
};

export const listCategories = async (): Promise<Category[]> => {
	const { items } = await listDocs<Category>({
		collection: Collection.CATEGORIES
	});
	return items.map((doc) => doc.data);
};
