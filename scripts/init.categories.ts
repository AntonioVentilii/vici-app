import { setDoc } from '@junobuild/core';
import { Collection } from '../src/lib/constants/collections.constants';
import type { Category } from '../src/lib/types/category';

const INITIAL_CATEGORIES: Category[] = [
	{ id: 'crypto', name: 'Crypto', description: 'Blockchain and cryptocurrency markets' },
	{ id: 'sports', name: 'Sports', description: 'Football, Basketball, and other sports events' },
	{ id: 'politics', name: 'Politics', description: 'Elections and political developments' },
	{ id: 'tech', name: 'Technology', description: 'AI, Big Tech, and software releases' },
	{ id: 'science', name: 'Science', description: 'Space, Health, and scientific discoveries' }
];

export const initCategories = async () => {
	console.log('Initializing categories...');
	for (const cat of INITIAL_CATEGORIES) {
		await setDoc({
			collection: Collection.CATEGORIES,
			doc: {
				key: cat.id,
				data: cat
			}
		});
		console.log(`- Initialized category: ${cat.name}`);
	}
	console.log('Categories initialization complete.');
};
