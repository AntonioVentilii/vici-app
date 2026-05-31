/**
 * School membership verification — submit + 6-digit code.
 *
 * ⚠️ BACKEND BOUNDARY (B.1 — NOT YET BUILT). The two calls below are
 * the only network surface the "add your own university" pass needs.
 * They map to two endpoints that have not been implemented yet:
 *
 *   POST /schools/submit  ({ name, country, email }) -> { submissionId }
 *     · emails a 6-digit numeric code to `email`
 *     · persists the submission (status awaiting-verification, TTL ~30m)
 *
 *   POST /schools/verify  ({ submissionId, code }) -> { ok, schoolId?, status? }
 *     · on success attaches the school to the user and bumps its
 *       verified-member count; the school goes public at 3 verified
 *
 * Both are stubbed to throw so the gated UI never silently "succeeds"
 * against a backend that can't honour it. The add-your-own pass is
 * additionally gated by `SCHOOL_PASS2_ENABLED` (default `false`), so
 * these throwers are unreachable in shipped builds until B.1 lands and
 * the flag is flipped.
 *
 * When B.1 is built, replace the bodies with the real round-trips
 * (wrap them in `withTimeout` like the rest of `worlds.services.ts`)
 * and keep the call signatures so the picker needs no changes.
 */

const NOT_IMPLEMENTED =
	'School verification endpoints are not implemented yet (backend item B.1). ' +
	'Keep SCHOOL_PASS2_ENABLED off until /schools/submit and /schools/verify ship.';

export interface SchoolSubmitInput {
	/** School display name as the user typed / picked it. */
	name: string;
	/** Inferred home country (ISO-3166 alpha-2). */
	country: string | null;
	/** The school email the code is sent to. */
	email: string;
	/** Set when verifying membership of an existing directory school. */
	schoolId?: string;
}

export interface SchoolSubmitResult {
	/** Opaque handle echoed back to {@link verifySchoolCode}. */
	submissionId: string;
}

export interface SchoolVerifyInput {
	submissionId: string;
	/** Six-digit numeric code from the user's inbox. */
	code: string;
}

export interface SchoolVerifyResult {
	ok: boolean;
	/** Present on success — the canonical school id to attach. */
	schoolId?: string;
	/** Present on success — the resulting membership status. */
	status?: 'pending' | 'public';
	/** Present on failure — a human-readable reason. */
	message?: string;
}

/**
 * Stub for `POST /schools/submit`. Throws until B.1 is wired —
 * unreachable while `SCHOOL_PASS2_ENABLED` is `false`.
 */
export const submitSchool = (_input: SchoolSubmitInput): Promise<SchoolSubmitResult> =>
	Promise.reject(new Error(NOT_IMPLEMENTED));

/**
 * Stub for `POST /schools/verify`. Throws until B.1 is wired —
 * unreachable while `SCHOOL_PASS2_ENABLED` is `false`.
 */
export const verifySchoolCode = (_input: SchoolVerifyInput): Promise<SchoolVerifyResult> =>
	Promise.reject(new Error(NOT_IMPLEMENTED));
