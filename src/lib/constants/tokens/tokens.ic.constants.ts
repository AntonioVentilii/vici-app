import {
	CKUSDC_LEDGER_CANISTER_ID,
	ICP_LEDGER_CANISTER_ID
} from '$lib/constants/canisters.constants';
import type { Token } from '$lib/types/token';
import { parseTokenId } from '$lib/validation/token.validation';

export const ICP_TOKEN: Token = {
	id: parseTokenId('ICP'),
	symbol: 'ICP',
	decimals: 8,
	ledgerCanisterId: ICP_LEDGER_CANISTER_ID
};

export const CKUSDC_TOKEN: Token = {
	id: parseTokenId('ckUSDC'),
	symbol: 'ckUSDC',
	decimals: 6,
	ledgerCanisterId: CKUSDC_LEDGER_CANISTER_ID
};

export const SUPPORTED_TOKENS: Token[] = [ICP_TOKEN, CKUSDC_TOKEN];
