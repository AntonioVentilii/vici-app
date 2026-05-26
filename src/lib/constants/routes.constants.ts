export enum AppPath {
	/**
	 * Canonical signed-in entry. Cold-load on `/` redirects here once the
	 * auth handshake resolves a session; in-app nav links to "Home"
	 * (Markets tab) target this path directly to avoid a `/ → /app`
	 * double-bounce flicker.
	 */
	App = '/app',
	/**
	 * Alias for the home-tab destination. Currently routes to `/app`
	 * (which renders the markets listing). Kept distinct from
	 * `AppPath.App` so we can re-aim the home tab without churning every
	 * call-site.
	 */
	// eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
	Home = '/app',
	Markets = '/markets',
	Profile = '/profile',
	Album = '/profile/album',
	Wallet = '/wallet',
	Admin = '/admin',
	AdminAccess = '/admin/access',
	AdminMarkets = '/admin/markets',
	AdminResolutions = '/admin/resolutions',
	Dash = '/dash',
	Portfolio = '/portfolio',
	Social = '/social',
	Flow = '/flow',
	Settings = '/settings',
	AccountSettings = '/settings/account',
	Notifications = '/notifications'
}

/**
 * Public surfaces — accessible without an authenticated session.
 * The (app) layout gate redirects unauthenticated users to `/signin`
 * unless they're already on a path in this set.
 *
 * `SignIn` is the canonical landing surface for unauthenticated users;
 * `SignUp` hosts the pre-sign-in onboarding flow (). `/auth/...`
 * is the OAuth callback path used by `signInWithGoogle` and friends.
 */
export enum PublicPath {
	SignIn = '/signin',
	SignUp = '/signup',
	/**
	 * Canonical share-able marketing URL. Signed-in users can visit
	 * `/about` without being bounced to `/app`, so the marketing site
	 * stays linkable from anywhere.
	 */
	About = '/about',
	/**
	 * Legacy marketing path. Retained for backward-compat — the route
	 * itself just redirects to `PublicPath.About`.
	 */
	Welcome = '/welcome',
	Info = '/info'
}

/**
 * Path prefixes that can be reached without a session — covers
 * `PublicPath` plus the OAuth callback paths under `/auth/`.
 *
 * Each entry is the prefix *without* a trailing slash; `isPublicPath`
 * checks both exact-match and `startsWith(prefix + '/')`, so e.g.
 * `'/auth'` matches `/auth/callback/google` while `'/auth/'` would
 * collapse the `startsWith` to `'/auth//'` and never match real
 * callback paths.
 */
export const PUBLIC_PATH_PREFIXES: readonly string[] = [
	PublicPath.SignIn,
	PublicPath.SignUp,
	PublicPath.About,
	PublicPath.Welcome,
	PublicPath.Info,
	'/auth'
] as const;

export const isPublicPath = (pathname: string): boolean =>
	PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
