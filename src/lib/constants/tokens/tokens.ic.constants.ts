import {
	CKUSDC_LEDGER_CANISTER_ID,
	ICP_LEDGER_CANISTER_ID
} from '$lib/constants/canisters.constants';
import type { Token } from '$lib/types/token';

export const ICP_TOKEN: Token = {
	symbol: 'ICP',
	decimals: 8,
	ledgerCanisterId: ICP_LEDGER_CANISTER_ID
};

export const CKUSDC_TOKEN: Token = {
	symbol: 'ckUSDC',
	decimals: 6,
	ledgerCanisterId: CKUSDC_LEDGER_CANISTER_ID
};
