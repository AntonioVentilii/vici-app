import juno from '@junobuild/vite-plugin';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), juno(), tailwindcss()],
	resolve: {
		alias: {
			$declarations: resolve('./src/declarations')
		}
	},
	worker: {
		plugins: () => [sveltekit()],
		format: 'es'
	}
});
