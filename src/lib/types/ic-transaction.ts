import type { IcpIndexDid } from '@icp-sdk/canisters/ledger/icp';
import type { IcrcIndexDid } from '@icp-sdk/canisters/ledger/icrc';

export interface IcTransactionAddOnsInfo {
	transferToSelf?: 'send' | 'receive';
}

export type IcpTransaction = {
	transaction: IcpIndexDid.Transaction & IcTransactionAddOnsInfo;
} & Pick<IcpIndexDid.TransactionWithId, 'id'>;

export type IcrcTransaction = {
	transaction: IcrcIndexDid.Transaction & IcTransactionAddOnsInfo;
} & Pick<IcrcIndexDid.TransactionWithId, 'id'>;
