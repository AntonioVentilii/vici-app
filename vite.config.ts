import juno from '@junobuild/vite-plugin';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), juno(), tailwindcss()],
	server: {
		proxy: {
			'/api': {
				target: 'http://localhost:5987',
				changeOrigin: true
			}
		}
	},
	resolve: {
		alias: {
			$declarations: resolve('./src/declarations'),
			$routes: resolve('./src/lib/routes'),
			$lib: resolve('./src/lib'),
			$satellite: resolve('./src/satellite')
		}
	},
	worker: {
		plugins: () => [sveltekit()],
		format: 'es'
	}
});
