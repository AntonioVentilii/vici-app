import { defineConfig } from '@junobuild/config';
import collections from './juno.collections.json';

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
					collection: collections.ROLES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: collections.PROFILES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: collections.RELATIONS,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: collections.CHATS,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: collections.COMMENTS,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: collections.CATEGORIES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: collections.SERIES_CATEGORIES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: collections.ACTIVITIES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: collections.VXP_ONBOARDING,
					memory: 'stable',
					read: 'public',
					write: 'public'
				}
			]
		}
	}
});
