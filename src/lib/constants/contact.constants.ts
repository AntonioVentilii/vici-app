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

/** General support / help inbox. */
export const SUPPORT_EMAIL = `support@${CONTACT_DOMAIN}`;

/** General hello / press inbox. */
export const HELLO_EMAIL = `hello@${CONTACT_DOMAIN}`;

/** Privacy / data-rights requests (referenced from the privacy policy). */
export const PRIVACY_EMAIL = `privacy@${CONTACT_DOMAIN}`;

/** Resolution-dispute filings (referenced from the resolution rules). */
export const RESOLUTION_EMAIL = `resolution@${CONTACT_DOMAIN}`;
