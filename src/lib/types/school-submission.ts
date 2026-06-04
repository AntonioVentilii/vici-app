/**
 * School-email verification submissions — backend item B.1.
 *
 * One doc per pending (member, email, school) verification attempt, in
 * the server-owned `school_submissions` collection. The satellite is the
 * ONLY writer (the collection is controllers-scoped); a client never
 * reads or writes these directly. The doc never stores the plaintext
 * 6-digit code — only an `FNV-1a(code|salt)` digest, mirroring the
 * existing referral code-generation idiom (the Sputnik runtime exposes
 * no cryptographic hash). The plaintext code lives only in the email
 * and the single outbound HTTPS-outcall body to `vici-courier`.
 *
 * The doc key (see {@link schoolSubmissionKey}) doubles as the opaque
 * `submissionId` handed back to the FE and is deterministic in
 * `(member, email, school)` so a resend collides with — and overwrites
 * — the prior attempt instead of piling up rows. Its `${member}/` prefix
 * authorizes verification: only the owning principal can verify it.
 */

/** Lifecycle of a verification submission. */
export type SchoolSubmissionStatus = 'awaiting' | 'verified' | 'expired';

export interface SchoolSubmissionDoc {
	/** Member principal text — matches the key prefix; authorizes verify. */
	member: string;
	/** Lower-cased school email the code was mailed to. */
	email: string;
	/**
	 * Canonical school id this submission resolves to. For a directory
	 * school it's the `WorldsAffiliationOption.id`; for a brand-new school
	 * it's the normalized-name slug. Server-derived, never client-trusted.
	 */
	schoolId: string;
	/** School display name as picked / typed (carried for new schools). */
	schoolName: string;
	/** Inferred home country (ISO-3166 alpha-2), if known. */
	country: string | null;
	/** Verified email domains for the school — fed into the registry row. */
	domains: string[];
	/** Whether `schoolId` is a new (off-directory) school. */
	isNew: boolean;
	/** `FNV-1a(code|salt)` hex digest. Never the plaintext code. */
	codeHash: string;
	/** Per-submission 64-bit salt (hex), seeded from `raw_rand`. */
	salt: string;
	/** Wall-clock ms after which the code is dead (~30 min). */
	expiresAtMs: number;
	/** Failed-attempt counter; capped to defend against guessing. */
	attempts: number;
	/** Lifecycle marker. */
	status: SchoolSubmissionStatus;
	/** Submission time (ms). Drives the per-day rate limit. */
	createdAtMs: number;
	/** Set on success — when the code was accepted (ms). */
	verifiedAtMs?: number;
}

/**
 * 64-bit FNV-1a over the input string, returned as zero-padded hex.
 * Cheap and deterministic — adequate to compare a submitted 6-digit code
 * against the stored digest. NOT a cryptographic hash: a 6-digit space
 * is brute-forceable offline, so on-chain storage is not the secrecy
 * boundary (the code only ever leaves via the email + the courier
 * outcall). The real defenses are the attempt cap, TTL, and rate limit.
 * Mirrors `fnv1a64` in `src/satellite/services/referral.services.ts`.
 */
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK64 = 0xffffffffffffffffn;

export const fnv1a64Hex = (input: string): string => {
	const bytes = new TextEncoder().encode(input);
	let hash = FNV_OFFSET;

	for (const b of bytes) {
		hash = (hash ^ BigInt(b)) & MASK64;
		hash = (hash * FNV_PRIME) & MASK64;
	}

	return hash.toString(16).padStart(16, '0');
};

/** Digest a code under a per-submission salt for storage / comparison. */
export const hashSchoolCode = ({ code, salt }: { code: string; salt: string }): string =>
	fnv1a64Hex(`${code}|${salt}`);

/**
 * Deterministic submission key / `submissionId`. The `${member}/` prefix
 * binds the row to its owner (verify authorization); the trailing segment
 * collapses resends for the same email+school into one row. `email` is
 * folded through {@link fnv1a64Hex} so the key stays opaque and free of
 * `/` or `@` separators.
 */
export const schoolSubmissionKey = ({
	member,
	email,
	schoolId
}: {
	member: string;
	email: string;
	schoolId: string;
}): string => `${member}/${fnv1a64Hex(email.toLowerCase().trim())}/${schoolId}`;
