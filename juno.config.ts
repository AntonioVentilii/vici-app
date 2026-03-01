import { defineConfig, type Rule } from '@junobuild/config';
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
					read: 'public',
					write: 'public'
				}
			] as Rule[]
		}
	}
});
