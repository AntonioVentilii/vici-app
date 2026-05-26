import juno from '@junobuild/vite-plugin';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Read package.json version + best-effort short commit SHA so the Settings
// page's About line can surface `VICI · v{version} · Build {sha}`. The SHA
// is the short HEAD hash at build time — falls back to `dev` when git is
// unavailable (CI without history, fresh clone, etc.).
const pkg = JSON.parse(readFileSync(resolve('./package.json'), 'utf-8')) as {
	version?: string;
};

const buildSha = (() => {
	try {
		return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return 'dev';
	}
})();

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version ?? '0.0.0'),
		__BUILD_SHA__: JSON.stringify(buildSha)
	},
	plugins: [sveltekit(), juno(), tailwindcss()],
	server: {
		fs: {
			allow: ['.']
		},
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
