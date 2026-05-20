export enum AppPath {
	Home = '/',
	Markets = '/markets',
	Profile = '/profile',
	Wallet = '/wallet',
	Admin = '/admin',
	Portfolio = '/portfolio',
	Leaderboard = '/leaderboard',
	Flow = '/flow',
	Settings = '/settings',
	Notifications = '/notifications'
}

/**
 * Public surfaces — accessible without an authenticated session.
 * The (app) layout gate redirects unauthenticated users to `/signin`
 * unless they're already on a path in this set.
 *
 * `SignIn` is the canonical landing surface for unauthenticated users;
 * `SignUp` hosts the pre-sign-in onboarding flow (Phase 2). `/auth/...`
 * is the OAuth callback path used by `signInWithGoogle` and friends.
 */
export enum PublicPath {
	SignIn = '/signin',
	SignUp = '/signup',
	Welcome = '/welcome'
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
	PublicPath.Welcome,
	'/auth'
] as const;

export const isPublicPath = (pathname: string): boolean =>
	PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
