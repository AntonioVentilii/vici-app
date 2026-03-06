import type { IcpIndexDid } from '@icp-sdk/canisters/ledger/icp';

export interface IcTransactionAddOnsInfo {
	transferToSelf?: 'send' | 'receive';
}

export type IcpTransaction = {
	transaction: IcpIndexDid.Transaction & IcTransactionAddOnsInfo;
} & Pick<IcpIndexDid.TransactionWithId, 'id'>;
