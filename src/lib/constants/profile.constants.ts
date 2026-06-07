import { DAY_IN_MS } from '$lib/constants/app.constants';

/**
 * Nickname (= handle) rules. The STORED value is preserved as the user
 * typed it — **case and accents are kept** (`José`, `CaféOwner`). The only
 * hard rule on what may be stored is the charset: letters of any language,
 * digits, and the separators `. _ -`. Everything else — whitespace, `@`,
 * other punctuation/symbols, emoji — is forbidden.
 *
 * Uniqueness is case- AND accent-insensitive: see {@link nicknameUniqueKey}.
 * `José`, `JOSE` and `jose` are the same handle and cannot coexist; the
 * stored form is whichever the owner chose.
 *
 * 2–16 chars. These bound the onboarding picker, the live-probe gate and
 * the claim-time gate so all three stay in sync; the satellite is the
 * authority (rejects anything failing {@link NICKNAME_PATTERN} / shorter
 * than {@link MIN_NICKNAME_LENGTH}).
 */
export const MIN_NICKNAME_LENGTH = 2;
export const MAX_NICKNAME_LENGTH = 16;

/**
 * Validates the stored charset: letters (any language, case + accents
 * preserved) + digits + `. _ -`. Rejects whitespace, `@`, every other
 * symbol/punctuation, and emoji.
 *
 * Built via `new RegExp` inside a guard ON PURPOSE: a `\p{L}` literal would
 * be a *parse-time* SyntaxError on a JS engine without Unicode property
 * escapes — which, in the satellite, would take down the whole module on
 * load. If the engine can't compile it we degrade to ASCII + the Latin
 * accent ranges (Latin-1 Supplement / Latin Extended-A/B) so the common
 * European accents still pass. Browsers always take the precise branch.
 */
const buildNicknamePattern = (): RegExp => {
	try {
		return new RegExp('^[\\p{L}\\p{M}0-9._-]+$', 'u');
	} catch {
		// ASCII + Latin-1 Supplement / Latin Extended-A/B accented letters.
		return new RegExp('^[A-Za-z0-9._\\u00C0-\\u024F-]+$');
	}
};

export const NICKNAME_PATTERN = buildNicknamePattern();

/**
 * Strips every character a handle may not contain while **preserving case
 * and accents** — the input-time inverse of {@link NICKNAME_PATTERN}.
 * NFC-normalises first so the stored value is canonical (a precomposed `é`,
 * not `e` + a combining accent), then drops anything outside
 * `[letters · marks · digits · . _ -]` (this is what removes all
 * whitespace, including spaces in the middle, plus `@` and other symbols),
 * then clamps to {@link MAX_NICKNAME_LENGTH}. FE-only (the satellite
 * rejects via {@link NICKNAME_PATTERN}), so the `\p{L}` literal is safe.
 * Shared by the onboarding picker and the sign-in bootstrap.
 */
export const sanitizeNickname = (raw: string): string =>
	raw
		.normalize('NFC')
		.replace(/[^\p{L}\p{M}0-9._-]/gu, '')
		.slice(0, MAX_NICKNAME_LENGTH);

/**
 * Folds a handle to its **uniqueness key** — case- and accent-insensitive.
 * `NFKD` decomposes accented letters into base + combining mark, the range
 * strip removes the marks (Combining Diacritical Marks, U+0300–U+036F — a
 * plain range with no Unicode property escape, so it runs in the satellite
 * engine too), and `toLowerCase` removes case. `José` / `JOSE` / `jose` all
 * fold to `jose`. Separators `. _ -` are KEPT (they're meaningful), so
 * `a_b` ≠ `ab`. Used for collision detection AND handle-change detection on
 * both the client and the satellite, so they always agree on what counts as
 * "the same handle".
 */
const COMBINING_DIACRITICAL_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');
export const nicknameUniqueKey = (raw: string): string =>
	raw.normalize('NFKD').replace(COMBINING_DIACRITICAL_MARKS, '').toLowerCase();

export const PENDING_ONBOARDING_STORAGE_KEY = 'vici:pending-onboarding';

/**
 * Handle (public @-name) editing rules. The handle is the same field as
 * the profile nickname, surfaced through the dedicated {@link
 * HandleEditor} sheet with a slightly stricter client-side charset than the
 * onboarding picker — letters (any language, case + accents preserved),
 * numbers and underscores only (no `.` / `-`), 3–15 characters. Like the
 * nickname, the STORED value keeps case + accents and uniqueness folds them
 * ({@link nicknameUniqueKey}).
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
 * Normalises raw input into a valid handle candidate, **preserving case and
 * accents** (the stored handle keeps the owner's form). NFC-normalise, strip
 * anything outside `[letters · marks · digits · _]` — removing whitespace,
 * `@` and every other symbol — then clamp to {@link MAX_HANDLE_LENGTH}.
 * FE-only (the satellite rejects via {@link NICKNAME_PATTERN}), so the
 * `\p{L}` literal is safe. Uniqueness still folds case + accents via
 * {@link nicknameUniqueKey}.
 */
export const cleanHandle = (raw: string): string =>
	raw
		.normalize('NFC')
		.replace(/[^\p{L}\p{M}0-9_]/gu, '')
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

	// Clamp to [0, HANDLE_COOLDOWN_DAYS]: a `lastChangeMs` skewed slightly into
	// the future (tolerated client clock skew) yields a negative `daysSince`,
	// which would otherwise report more than the full cooldown and over-extend
	// the lockout. The full window is the hard ceiling; never report negative.
	return Math.min(HANDLE_COOLDOWN_DAYS, HANDLE_COOLDOWN_DAYS - daysSince);
};
