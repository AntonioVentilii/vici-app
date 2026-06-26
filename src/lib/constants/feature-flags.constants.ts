/**
 * Build-time feature flags.
 *
 * These are hardcoded booleans, not runtime config: flipping one is a
 * code change that goes through review. They exist to keep a fully-built
 * code path in the tree while it is intentionally not exposed in the UI,
 * so re-enabling it is a one-line flip rather than a re-implementation.
 */

/**
 * Whether the market-detail page (`/markets/[id]`) lets the viewer place a
 * prediction directly from the page via the YES/NO CTA bar and the trade
 * sheet.
 *
 * When `false` (the default) the detail page is a read-only depth view —
 * the probability hero, chart, stats, and resolution context are all on
 * display, but predictions are made in Flow rather than here. The in-detail
 * trade CTA and its trade sheet are kept behind this flag, ready to be
 * restored by flipping it back to `true`.
 */
export const MARKET_DETAIL_DIRECT_TRADE_ENABLED = false;

/**
 * Whether `/signup` renders the one-screen onboarding (handle claim + auth
 * provider entry on a single surface) instead of the multi-beat flow.
 *
 * When `true` (the default) `/signup` mounts `OnboardingV3`: the user claims
 * a handle and signs up in one view, team selection deferred to the
 * post-signup Profile. When `false` the multi-beat flow (`OnboardingFlow`,
 * team → first call → handle → auth) is restored.
 *
 * The earlier multi-beat flow is intentionally kept in the tree behind the
 * off path until the one-screen flow is verified in production — a
 * regression is then a one-line flip back, not a revert. The cleanup that
 * deletes the multi-beat flow is a separate follow-up.
 */
export const ONBOARDING_V3_ENABLED = true;
