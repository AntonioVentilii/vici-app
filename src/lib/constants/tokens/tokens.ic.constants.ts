import {
	CHAT_LEDGER_CANISTER_ID,
	CKBTC_LEDGER_CANISTER_ID,
	CKETH_LEDGER_CANISTER_ID,
	CKUSDC_LEDGER_CANISTER_ID,
	GHOST_LEDGER_CANISTER_ID,
	ICP_LEDGER_CANISTER_ID
} from '$lib/constants/canisters.constants';
import { isDev } from '$lib/env/app.env';
import type { Token } from '$lib/types/token';
import { parseTokenId } from '$lib/validation/token.validation';

export const ICP_TOKEN: Token = {
	id: parseTokenId('ICP'),
	symbol: 'ICP',
	decimals: 8,
	ledgerCanisterId: ICP_LEDGER_CANISTER_ID,
	isDevEnabled: true
};

export const CKUSDC_TOKEN: Token = {
	id: parseTokenId('ckUSDC'),
	symbol: 'ckUSDC',
	decimals: 6,
	ledgerCanisterId: CKUSDC_LEDGER_CANISTER_ID,
	isDevEnabled: true
};

export const CKBTC_TOKEN: Token = {
	id: parseTokenId('ckBTC'),
	symbol: 'ckBTC',
	decimals: 8,
	ledgerCanisterId: CKBTC_LEDGER_CANISTER_ID,
	disabled: true
};

export const CKETH_TOKEN: Token = {
	id: parseTokenId('ckETH'),
	symbol: 'ckETH',
	decimals: 18,
	ledgerCanisterId: CKETH_LEDGER_CANISTER_ID,
	disabled: true
};

export const CHAT_TOKEN: Token = {
	id: parseTokenId('CHAT'),
	symbol: 'CHAT',
	decimals: 8,
	ledgerCanisterId: CHAT_LEDGER_CANISTER_ID,
	disabled: true
};

export const GHOST_TOKEN: Token = {
	id: parseTokenId('GHOST'),
	symbol: 'GHOST',
	decimals: 8,
	ledgerCanisterId: GHOST_LEDGER_CANISTER_ID,
	disabled: true
};

export const SUPPORTED_TOKENS: Token[] = [
	ICP_TOKEN,
	CKUSDC_TOKEN,
	CKBTC_TOKEN,
	CKETH_TOKEN,
	CHAT_TOKEN,
	GHOST_TOKEN
].filter(({ disabled, isDevEnabled }) => !disabled && (!isDev() || (isDevEnabled ?? false)));
