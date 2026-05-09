/**
 * Shared E2E configuration.
 *
 * The Juno emulator (`junobuild/satellite` image) exposes a local replica
 * with Internet Identity pre-deployed at the standard II canister ID.
 * See https://juno.build/docs/guides/e2e for details.
 *
 * These values are environment-overridable so the same specs run against
 * either a Juno emulator (default) or a custom local replica.
 */
export const E2E_CONFIG = {
	iiUrl: process.env.E2E_II_URL ?? 'http://127.0.0.1:5987',
	iiCanisterId: process.env.E2E_II_CANISTER_ID ?? 'rdmx6-jaaaa-aaaaa-aaadq-cai',
	iiReadyTimeoutMs: 60_000
} as const;
