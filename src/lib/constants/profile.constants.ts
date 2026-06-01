import { DAY_IN_MS } from '$lib/constants/app.constants';

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
 * Enforcement is server-authoritative: the profile carries a
 * `handleLastChangeMs` timestamp and the set-profile assertion rejects a
 * handle change while the stored value is inside the window (and stamps
 * the message time on an allowed change). The {@link HandleEditor}
 * mirrors the same rule client-side from `handleLastChangeMs` so the UI
 * disables the editor and explains the wait before a doomed write.
 *
 * This constant is shared by the frontend and the satellite assertion so
 * both sides agree on the window.
 */
export const HANDLE_COOLDOWN_DAYS = 30;

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

/**
 * Whole days the owner must still wait before the handle can change again,
 * given the timestamp of the last change (`handleLastChangeMs`) and a
 * reference "now" (both wall-clock ms). Returns 0 when the cooldown has
 * elapsed or no prior change is on record (`lastChangeMs` nullish) — i.e.
 * the handle is changeable. Shared by the {@link HandleEditor} (to disable
 * + explain the wait) and the set-profile assertion (to reject a doomed
 * write), so the UI and the satellite agree on the window.
 */
export const handleCooldownDaysLeft = ({
	lastChangeMs,
	nowMs
}: {
	lastChangeMs: number | undefined | null;
	nowMs: number;
}): number => {
	if (lastChangeMs === undefined || lastChangeMs === null || lastChangeMs <= 0) {
		return 0;
	}

	const daysSince = Math.floor((nowMs - lastChangeMs) / DAY_IN_MS);

	if (daysSince >= HANDLE_COOLDOWN_DAYS) {
		return 0;
	}

	return HANDLE_COOLDOWN_DAYS - daysSince;
};
