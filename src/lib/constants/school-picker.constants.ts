/**
 * School-picker feature gating.
 *
 * The "add your own university" pass — submit a school + school email,
 * receive a 6-digit code, verify membership — depends on two backend
 * endpoints that are **not yet built** (tracked as backend item B.1:
 * `/schools/submit` + `/schools/verify`). Until those land,
 * {@link SCHOOL_PASS2_ENABLED} stays `false`: the picker ships the
 * directory browse + fuzzy search + status badges + the always-
 * reachable "use it unverified" path, and hides every surface that
 * would call the unimplemented endpoints (the add-your-own CTAs,
 * founder badges, and the empty-state "add" hero).
 *
 * Do NOT flip this to `true` in production before B.1 is wired AND the
 * `vici-courier` email service is deployed with its `app_config`
 * relay doc set — until then the submit call cannot actually mail a
 * code (see `school-verification.services.ts` + the satellite
 * `submitSchool` / `verifySchoolCode` endpoints).
 */
export const SCHOOL_PASS2_ENABLED = false;

/**
 * Cap on how many "founder" badges render in a single directory list,
 * so an unseeded region doesn't wallpaper every row with the badge.
 */
export const SCHOOL_FOUNDER_BADGE_CAP = 3;

/**
 * Length of the membership verification code mailed to the school
 * address. The prototype's pass-2 (point of truth) uses six digits.
 */
export const SCHOOL_CODE_LENGTH = 6;

/**
 * Time-to-live of a verification code (ms). After this the submission is
 * dead and the user must request a fresh code. Matches the prototype's
 * "~30 minutes".
 */
export const SCHOOL_CODE_TTL_MS = 30 * 60 * 1000;

/**
 * Max wrong code entries before a submission is locked. Bounds online
 * guessing of the 6-digit space to {@link SCHOOL_CODE_MAX_ATTEMPTS} in
 * 1,000,000 per submission — the real defense, since the stored digest
 * is not cryptographic.
 */
export const SCHOOL_CODE_MAX_ATTEMPTS = 5;

/**
 * Max code sends per principal per rolling 24h, and (separately) per
 * email per rolling 24h. Defends the email vendor + the user's inbox
 * against being used as a spam relay.
 */
export const SCHOOL_VERIFY_DAILY_CAP = 5;
