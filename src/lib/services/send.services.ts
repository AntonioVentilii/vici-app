import { transfer as transferIcrc } from '$lib/api/icrc-ledger.api';
import type { IcSendParams } from '$lib/types/ic-send';
import { decodeIcrcAccount, type IcrcLedgerDid } from '@icp-sdk/canisters/ledger/icrc';

export const sendIc = async (params: IcSendParams): Promise<void> => {
	await sendIcrc(params);
};

export const sendIcrc = ({
	to,
	amount,
	identity,
	ledgerCanisterId
}: IcSendParams): Promise<IcrcLedgerDid.BlockIndex> =>
	transferIcrc({
		identity,
		ledgerCanisterId,
		to: decodeIcrcAccount(to),
		amount
	});
