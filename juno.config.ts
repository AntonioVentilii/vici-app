import { defineConfig } from '@junobuild/config';

/**
 * Datastore collection names for `satellite.collections` below.
 *
 * We keep them here instead of importing e.g. `./juno.collections.json`. Juno’s Docker-based
 * emulator/CLI often evaluates this config in an isolated context where extra project files
 * are not available or not bundled—importing external JSON can fail silently or break config load.
 * Track upstream: https://github.com/junobuild/juno-docker/issues/262
 *
 * The app still uses `juno.collections.json` via `Collection` in `src/lib`; keep both in sync when renaming.
 */
enum JunoDatastoreCollection {
	ROLES = 'roles',
	PROFILES = 'profiles',
	RELATIONS = 'relations',
	CHATS = 'chats',
	COMMENTS = 'comments',
	CATEGORIES = 'categories',
	SERIES_CATEGORIES = 'series_categories',
	ACTIVITIES = 'activities',
	VXP_ONBOARDING = 'vxp_onboarding'
}

const delegation = {
	// Like identities derived by Internet Identity, those derived with OpenID
	// are allowed to interact with any canister on the Internet Computer.
	allowedTargets: null,
	sessionDuration: BigInt(7 * 24 * 60 * 60 * 1000 * 1000 * 1000) // 7 days in nanoseconds
};

export default defineConfig(({ mode }) => ({
	satellite: {
		ids: {
			development: 'auamu-4x777-77775-aaaaa-cai',
			production: '7scay-7yaaa-aaaal-asxqa-cai'
		},
		source: 'build',
		predeploy: ['npm run build'],
		authentication: {
			google: {
				clientId:
					mode === 'production'
						? '215111139647-7hat1jefroe7tkgu5kds4s8sv4dgf3fu.apps.googleusercontent.com'
						: '794351932143-em7c7j4rko2ok5fhk4crhv6f44ifmpqv.apps.googleusercontent.com',
				delegation
			}
		},
		collections: {
			datastore: [
				{
					collection: JunoDatastoreCollection.ROLES,
					memory: 'stable',
					read: 'managed',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.PROFILES,
					memory: 'stable',
					read: 'managed',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.RELATIONS,
					memory: 'stable',
					read: 'managed',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.CHATS,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.COMMENTS,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.CATEGORIES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.SERIES_CATEGORIES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.ACTIVITIES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.VXP_ONBOARDING,
					memory: 'stable',
					read: 'public',
					write: 'public'
				}
			]
		}
	}
}));
