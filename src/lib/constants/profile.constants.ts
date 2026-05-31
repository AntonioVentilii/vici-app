export const MIN_NICKNAME_LENGTH = 2;

export const PENDING_ONBOARDING_STORAGE_KEY = 'vici:pending-onboarding';

/**
 * Handle (public @-name) editing rules. The handle is the same field as
 * the profile nickname, surfaced through the dedicated {@link
 * HandleEditor} sheet with stricter client-side rules than the generic
 * nickname validator: lowercase letters, numbers and underscores only,
 * 3–15 characters.
 */
export const MIN_HANDLE_LENGTH = 3;
export const MAX_HANDLE_LENGTH = 15;

/**
 * A handle can be changed once every {@link HANDLE_COOLDOWN_DAYS} days.
 *
 * NOTE — enforcement is client-side only today. The profile schema has
 * no "last handle change" timestamp, so the cooldown is tracked in
 * `localStorage` under {@link HANDLE_LAST_CHANGE_STORAGE_KEY}. This is a
 * soft guard (a determined user can clear storage); server-side
 * enforcement needs a profile-schema field + a satellite assertion.
 */
export const HANDLE_COOLDOWN_DAYS = 30;
export const HANDLE_LAST_CHANGE_STORAGE_KEY = 'vici:handle-last-change';

/**
 * Handles reserved for the platform — never assignable to a user even if
 * the backend availability check would otherwise pass.
 */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
	'admin',
	'vici',
	'root',
	'support',
	'help',
	'mod',
	'official',
	'team',
	'api',
	'www'
]);

/**
 * Normalises raw input into a valid handle candidate: lowercase, strip
 * anything outside `[a-z0-9_]`, clamp to {@link MAX_HANDLE_LENGTH}.
 */
export const cleanHandle = (raw: string): string =>
	raw
		.toLowerCase()
		.replace(/[^a-z0-9_]/g, '')
		.slice(0, MAX_HANDLE_LENGTH);
