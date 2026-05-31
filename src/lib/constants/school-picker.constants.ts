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
 * Do NOT flip this to `true` in production before B.1 is wired — the
 * submit / verify calls resolve to a stub that throws
 * "not implemented" (see `school-verification.services.ts`).
 */
export const SCHOOL_PASS2_ENABLED = false;

/**
 * Cap on how many "founder" badges render in a single directory list,
 * so an unseeded region doesn't wallpaper every row with the badge.
 */
export const SCHOOL_FOUNDER_BADGE_CAP = 3;
