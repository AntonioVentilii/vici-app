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
					collection: JunoDatastoreCollection.ROLES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.PROFILES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.RELATIONS,
					memory: 'stable',
					read: 'public',
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
});
