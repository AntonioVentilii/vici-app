import { ZERO } from '$lib/constants/app.constants';
import type { Outcome } from '$lib/types/market';

// Calculate settlement price for Clearing canister
// Binary: YES = 100, NO = 0
export const binaryPayoff = (outcome: Outcome): bigint | undefined =>
	outcome === 'YES' ? 100n : outcome === 'NO' ? ZERO : undefined;
