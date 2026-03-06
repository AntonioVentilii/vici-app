import { SUPPORTED_TOKENS } from '$lib/constants/tokens/tokens.ic.constants';
import type { Token } from '$lib/types/token';

export const findTokenByLedgerId = (ledgerCanisterId: string): Token | undefined =>
	SUPPORTED_TOKENS.find((t) => t.ledgerCanisterId === ledgerCanisterId);
