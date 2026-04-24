import { ZERO } from '$lib/constants/app.constants';
import type { Outcome } from '$lib/types/market';

/**
 * Binary settlement price for the clearing canister: YES → 100, NO → 0; other outcomes → undefined.
 */
export const binaryPayoff = (outcome: Outcome): bigint | undefined =>
	outcome === 'YES' ? 100n : outcome === 'NO' ? ZERO : undefined;

/**
 * Inverse of {@link binaryPayoff}: derives the `YES`/`NO` label from a numeric
 * settlement price. Used when logging resolution activity from a price-based
 * settlement so downstream consumers can show the winning outcome.
 *
 * Mirrors the engine's binary payoff rule: `price > 0` ⇒ YES, else NO.
 */
export const binaryPayoffLabel = (price: bigint): Outcome =>
	price > ZERO ? 'YES' : 'NO';
