/**
 * Builds an `href` for an email link without ever writing the `mailto:`
 * scheme as a contiguous literal in the source. Naive scrapers key off
 * the literal `mailto:` token to lift addresses out of served markup;
 * assembling the scheme from split parts at runtime denies them that
 * anchor while producing the exact same href the browser expects.
 *
 * Pair this with the runtime-assembled addresses in
 * `contact.constants` so neither the scheme nor the address appears
 * contiguously in the shipped source.
 */
const scheme = ['mail', 'to'].join('');

export const mailtoHref = (email: string): string => `${scheme}:${email}`;
