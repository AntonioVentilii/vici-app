import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import juno from '@junobuild/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [sveltekit(), juno(), tailwindcss()],
	worker: {
		plugins: () => [sveltekit()],
		format: 'es'
	}
});
