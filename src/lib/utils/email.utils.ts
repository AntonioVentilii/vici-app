/**
 * Builds an `href` for an email link without ever writing the `mailto:`
 * scheme as a contiguous literal in the source. Naive scrapers key off
 * the literal `mailto:` token to lift addresses out of served markup;
 * rebuilding the scheme from an encoded form at runtime denies them that
 * anchor while producing the exact same href the browser expects.
 *
 * The scheme is stored REVERSED as a single literal (`:otliam`, which
 * contains no `mailto` substring) and un-reversed at runtime via
 * `split/reverse/join`. The bundler's constant-folder evaluates pure
 * expressions at build time but does NOT execute string-instance methods
 * like `reverse()` on literals, so the `mailto:` token never re-appears in
 * the shipped bundle. Keep any change here verified against the built
 * output, not just the source.
 *
 * Pair this with the runtime-assembled addresses in `contact.constants`
 * so neither the scheme nor the address appears contiguously in the
 * shipped source.
 */
const REVERSED_SCHEME = ':otliam';
const scheme = REVERSED_SCHEME.split('').reverse().join('');

export const mailtoHref = (email: string): string => `${scheme}${email}`;
