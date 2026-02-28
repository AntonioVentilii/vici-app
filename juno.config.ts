import { defineConfig } from '@junobuild/config';

export default defineConfig({
	satellite: {
		ids: {
			development: 'auamu-4x777-77775-aaaaa-cai',
			production: 'auamu-4x777-77775-aaaaa-cai'
		},
		source: 'build',
		predeploy: ['npm run build']
	}
});
