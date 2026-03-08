import type { CanisterIdText } from '$lib/types/canister';
import type { TransferParams } from '$lib/types/send';
import type { Identity } from '@icp-sdk/core/agent';

export type IcTransferParams = Pick<TransferParams, 'amount' | 'to'> & {
	identity: Identity;
};

export type IcSendParams = IcTransferParams & {
	ledgerCanisterId: CanisterIdText;
};
