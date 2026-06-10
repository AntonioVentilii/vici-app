/**
 * Real contact addresses — the single source of truth for every
 * outward-facing email the product surfaces (FAQ, footer, account
 * deletion, legal copy, the public Info docs).
 *
 * These are contact identifiers, not translatable copy: keep them out
 * of the i18n catalogs and reference these constants wherever a real
 * address appears, so the domain lives in exactly one place. Illustrative
 * placeholders (`you@example.com` and friends) are intentionally NOT
 * defined here — those stay inline as examples.
 */

/** Apex domain all contact mailboxes hang off. */
export const CONTACT_DOMAIN = 'vici.market';

/**
 * Assembles a full address from its local-part and the apex domain,
 * joining them with an `@` produced at runtime (`String.fromCharCode(64)`
 * is the `@` character) rather than written as a literal. This is an
 * anti-harvest measure: the served source never carries a contiguous
 * `local@domain` string for naive scrapers to lift, while every consumer
 * still gets the exact same address at runtime.
 */
const at = String.fromCharCode(64);
const buildEmail = (local: string): string => `${local}${at}${CONTACT_DOMAIN}`;

/** General info / support / help inbox — the public-facing contact address. */
export const INFO_EMAIL = buildEmail('info');

/** General hello / press inbox. */
export const HELLO_EMAIL = buildEmail('hello');

/** Privacy / data-rights requests (referenced from the privacy policy). */
export const PRIVACY_EMAIL = buildEmail('privacy');

/** Resolution-dispute filings (referenced from the resolution rules). */
export const RESOLUTION_EMAIL = buildEmail('resolution');

/**
 * Public profile-share link for the growth loop. The Profile hero's "Invite
 * Friends" CTA shares `{base}/{handle}` so a recipient lands on the inviter's
 * handle. This is a structural URL, not translatable copy — kept here with the
 * apex domain so the host lives in exactly one place.
 */
export const PROFILE_JOIN_URL_BASE = `https://${CONTACT_DOMAIN}/join`;

/**
 * Builds the profile-share join link for a handle. The handle keeps the
 * owner's real form — the documented charset is letters (any language) +
 * digits + `. _ -` (see `NICKNAME_PATTERN` in profile.constants), so
 * stripping to ASCII
 * alphanumerics or lowercasing would mangle valid handles and break the
 * round-trip from the invite URL. `encodeURIComponent` makes the segment
 * URL-safe while preserving the exact handle on decode.
 */
export const profileJoinUrl = (handle: string): string =>
	`${PROFILE_JOIN_URL_BASE}/${encodeURIComponent(handle)}`;
