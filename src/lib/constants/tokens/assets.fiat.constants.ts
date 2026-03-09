import type { Token } from '$lib/types/token';
import { parseTokenId } from '$lib/validation/token.validation';

export const USD_ASSET: Token = {
	id: parseTokenId('USD'),
	symbol: 'USD',
	decimals: 2,
	ledgerCanisterId: ''
};
