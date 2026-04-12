import { ZERO } from '$lib/constants/app.constants';
import type { Outcome } from '$lib/types/market';

/**
 * Binary settlement price for the clearing canister: YES → 100, NO → 0; other outcomes → undefined.
 */
export const binaryPayoff = (outcome: Outcome): bigint | undefined =>
	outcome === 'YES' ? 100n : outcome === 'NO' ? ZERO : undefined;
