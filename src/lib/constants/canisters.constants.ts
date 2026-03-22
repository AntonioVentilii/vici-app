import { Principal } from '@icp-sdk/core/principal';

export const CLEARING_CANISTER_ID = Principal.fromText('g2or7-caaaa-aaaaj-qqhoa-cai');

export const REGISTRY_CANISTER_ID = Principal.fromText('g5pxl-pyaaa-aaaaj-qqhoq-cai');

export const ICP_LEDGER_CANISTER_ID = 'ryjl3-tyaaa-aaaaa-aaaba-cai';
export const ICP_INDEX_CANISTER_ID = 'qhbym-qaaaa-aaaaa-aaafq-cai';

export const CKUSDC_LEDGER_CANISTER_ID = 'xevnm-gaaaa-aaaar-qafnq-cai';
export const CKUSDC_INDEX_CANISTER_ID = 'xrs4b-hiaaa-aaaar-qafoa-cai';

export const CKBTC_LEDGER_CANISTER_ID = 'mxz4u-wiaaa-aaaar-qaada-cai';
export const CKETH_LEDGER_CANISTER_ID = 'ss2fx-dyaaa-aaaar-qacoa-cai';
export const CHAT_LEDGER_CANISTER_ID = '2ouvw-qaaaa-aaaag-qacaa-cai';
export const GHOST_LEDGER_CANISTER_ID = '4c4fd-caaaa-aaaaq-aaaqa-cai';

export const TESTICP_LEDGER_CANISTER_ID = 'xafvr-biaaa-aaaai-aql5q-cai';
export const TESTICP_INDEX_CANISTER_ID = 'qcuy6-bqaaa-aaaai-aqmqq-cai';

export const TICRC1_LEDGER_CANISTER_ID = '3jkp5-oyaaa-aaaaj-azwqa-cai';
export const TICRC1_INDEX_CANISTER_ID = 'qzre3-3iaaa-aaaai-aqmsa-cai';

const viteEnvString = (key: string): string | undefined => {
	if (typeof import.meta === 'undefined') {
		return undefined;
	}
	return (import.meta as ImportMeta & { env?: Record<string, string> }).env?.[key];
};

/** VXP ledger (ViciXp / playground). Override with `VITE_VXP_LEDGER_CANISTER_ID` for local replica. */
export const VXP_LEDGER_CANISTER_ID =
	viteEnvString('VITE_VXP_LEDGER_CANISTER_ID') ?? 's7ux4-yyaaa-aaaam-qidha-cai';

/** VICI ledger (settlement). Override with `VITE_VICI_LEDGER_CANISTER_ID` for local replica. */
export const VICI_LEDGER_CANISTER_ID =
	viteEnvString('VITE_VICI_LEDGER_CANISTER_ID') ?? 'zpaik-yaaaa-aaaam-qiczq-cai';
