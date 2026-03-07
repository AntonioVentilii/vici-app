import { defineConfig } from '@junobuild/config';
import { Collection } from './src/lib/constants/collections.constants';

export default defineConfig({
	satellite: {
		ids: {
			development: 'auamu-4x777-77775-aaaaa-cai',
			production: '7scay-7yaaa-aaaal-asxqa-cai'
		},
		source: 'build',
		predeploy: ['npm run build'],
		collections: {
			datastore: [
				{
					collection: Collection.ROLES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: Collection.PROFILES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: Collection.RELATIONS,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: Collection.CHATS,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: Collection.COMMENTS,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: Collection.CATEGORIES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: Collection.SERIES_CATEGORIES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: Collection.ACTIVITIES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: Collection.ORDERS,
					memory: 'stable',
					read: 'public',
					write: 'public'
				}
			]
		}
	}
});
