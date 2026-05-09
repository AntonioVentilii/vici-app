const viteEnv = (): ImportMetaEnv | undefined =>
	typeof import.meta !== 'undefined'
		? (import.meta as ImportMeta & { env?: ImportMetaEnv }).env
		: undefined;

export const isSkylab = (): boolean => viteEnv()?.MODE === 'skylab';
export const isNotSkylab = (): boolean => !isSkylab();

export const isDev = (): boolean => viteEnv()?.DEV === true || isSkylab();

export const isProd = (): boolean => viteEnv()?.PROD === true;

/**
 * True when the dev/preview server was started for an E2E run
 * (`VITE_E2E=true`). Used to unlock prod-only sign-in surfaces (real
 * Internet Identity, passkeys) so that Playwright can drive them against
 * the Juno emulator instead of the dev-only mock identity.
 *
 * Never set this in any deployed environment — it's a test-only seam.
 */
export const isE2E = (): boolean => viteEnv()?.VITE_E2E === 'true';
