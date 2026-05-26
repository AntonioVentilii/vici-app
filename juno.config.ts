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
	MARKET_METADATA = 'market_metadata',
	MARKET_TRANSLATIONS = 'market_translations',
	ACTIVITIES = 'activities',
	VXP_ONBOARDING = 'vxp_onboarding',
	VXP_AWARDS = 'vxp_awards',
	REFERRAL_CODES = 'referral_codes',
	REFERRALS = 'referrals',
	LEAGUES = 'leagues',
	LEAGUE_MEMBERS = 'league_members',
	BOUTS = 'bouts',
	AFFILIATIONS = 'affiliations',
	AFFILIATION_STATS = 'affiliation_stats',
	EXIT_SIGNALS = 'exit_signals',
	TOURNAMENTS = 'tournaments',
	TOURNAMENT_MATCHES = 'tournament_matches'
}

const delegation = {
	// Like identities derived by Internet Identity, those derived with OpenID
	// are allowed to interact with any canister on the Internet Computer.
	allowedTargets: null,
	sessionDuration: BigInt(7 * 24 * 60 * 60 * 1000 * 1000 * 1000) // 7 days in nanoseconds
};

/**
 * The Juno CLI's `--emulator` flag is only valid with `--mode development`,
 * so E2E (which runs against the `junobuild/satellite` image) must reuse
 * `mode === 'development'`. To avoid pointing the CLI at the *real* dev
 * satellite, callers (CI + local emulator workflows) export
 * `JUNO_EMULATOR=true`, which swaps `ids.development` to the predictable
 * satellite ID baked into the emulator image. See
 * `docs/ai/frontend/testing.md`.
 */
const isEmulator = process.env.JUNO_EMULATOR === 'true';

const EMULATOR_SATELLITE_ID = 'jx5yt-yyaaa-aaaal-abzbq-cai';

export default defineConfig(({ mode }) => ({
	satellite: {
		ids: {
			development: isEmulator ? EMULATOR_SATELLITE_ID : 'auamu-4x777-77775-aaaaa-cai',
			production: '7scay-7yaaa-aaaal-asxqa-cai'
		},
		hosting: {
			source: 'build',
			predeploy: ['npm run build']
		},
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
					collection: JunoDatastoreCollection.MARKET_METADATA,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.MARKET_TRANSLATIONS,
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
				},
				{
					collection: JunoDatastoreCollection.VXP_AWARDS,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.REFERRAL_CODES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.REFERRALS,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.LEAGUES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.LEAGUE_MEMBERS,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.BOUTS,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.AFFILIATIONS,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.AFFILIATION_STATS,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.EXIT_SIGNALS,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.TOURNAMENTS,
					memory: 'stable',
					read: 'public',
					write: 'public'
				},
				{
					collection: JunoDatastoreCollection.TOURNAMENT_MATCHES,
					memory: 'stable',
					read: 'public',
					write: 'public'
				}
			]
		}
	},
	emulator: {
		runner: {
			type: 'docker'
		},
		// `satellite` profile boots the minimal single-satellite emulator
		// (`junobuild/satellite:latest`). The `skylab` profile boots the
		// full Juno suite (`junobuild/skylab:latest`) with the dev Console,
		// but `juno functions build` exits silently with code 1 against it
		// — see commit 693c6a6 for the same revert we did earlier. Stick to
		// `satellite` until juno-cli fixes the skylab build path.
		satellite: {}
	}
}));
