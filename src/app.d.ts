// See https://kit.svelte.dev/docs/types#app for these interfaces.
declare global {
	namespace App {}

	/** Package version baked in at build time (see `vite.config.ts` `define`). */
	const __APP_VERSION__: string;
	/** Short HEAD commit SHA at build time (or `'dev'` outside git). */
	const __BUILD_SHA__: string;
}

export {};
