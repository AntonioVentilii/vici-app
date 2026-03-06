import { ZERO } from '$lib/constants/app.constants';
import type {
	IcpTransaction,
	IcrcTransaction,
	IcTransactionAddOnsInfo
} from '$lib/types/ic-transaction';
import type { Transaction } from '$lib/types/wallet';
import { fromNullable, isNullish, jsonReplacer, nonNullish } from '@dfinity/utils';
import { type IcpIndexDid, AccountIdentifier } from '@icp-sdk/canisters/ledger/icp';
import {
	type IcrcAccount,
	type IcrcIndexDid,
	encodeIcrcAccount,
	fromCandidAccount
} from '@icp-sdk/canisters/ledger/icrc';
import type { Identity } from '@icp-sdk/core/agent';
import type { Principal } from '@icp-sdk/core/principal';

export const getAccountIdentifier = (principal: Principal): AccountIdentifier =>
	AccountIdentifier.fromPrincipal({ principal, subAccount: undefined });

export const getIcrcAccount = (principal: Principal): IcrcAccount => ({ owner: principal });

export const mapTransactionIcpToSelf = (
	tx: IcpIndexDid.TransactionWithId
): ({ transaction: IcpIndexDid.Transaction & IcTransactionAddOnsInfo } & Pick<
	IcpIndexDid.TransactionWithId,
	'id'
>)[] => {
	const { transaction, id } = tx;
	const { operation } = transaction;

	if (!('Transfer' in operation)) {
		return [
			{
				id,
				transaction
			}
		];
	}

	const {
		Transfer: { from, to }
	} = operation;

	return [
		{
			id,
			transaction: {
				...transaction,
				transferToSelf: 'send'
			}
		},
		...(from.toLowerCase() === to.toLowerCase()
			? [
					{
						id,
						transaction: {
							...transaction,
							transferToSelf: 'receive' as const
						}
					}
				]
			: [])
	];
};

export const mapIcpTransaction = ({
	transaction: { transaction, id },
	token,
	identity
}: {
	transaction: IcpTransaction;
	token: Transaction['token'];
	identity: Identity;
}): Transaction => {
	const { operation, timestamp, transferToSelf } = transaction;

	const principal = identity.getPrincipal();

	const tx: Pick<Transaction, 'id' | 'user' | 'timestamp' | 'token'> = {
		id: `${id.toString()}${transferToSelf === 'receive' ? '-self' : ''}`,
		user: principal.toText(),
		timestamp: fromNullable(timestamp)?.timestamp_nanos ?? ZERO,
		token
	};

	const accountIdentifier = nonNullish(identity)
		? getAccountIdentifier(identity.getPrincipal())
		: undefined;

	if ('Approve' in operation) {
		const approve = operation.Approve;
		const approveValue = approve.allowance.e8s;

		return {
			...tx,
			type: 'Approve',
			amount: approveValue,
			counterparty: approve.spender
		};
	}

	if ('Burn' in operation) {
		return {
			...tx,
			type: 'Burn',
			amount: operation.Burn.amount.e8s,
			counterparty: operation.Burn.from
		};
	}

	if ('Mint' in operation) {
		return {
			...tx,
			type: 'Mint',
			amount: operation.Mint.amount.e8s,
			counterparty: operation.Mint.to
		};
	}

	if ('Transfer' in operation) {
		const { from } = operation.Transfer;
		const incoming =
			from?.toLowerCase() !== accountIdentifier?.toHex().toLowerCase() ||
			transferToSelf === 'receive';

		return {
			...tx,
			type: incoming ? 'Receive' : 'Send',
			amount: operation.Transfer.amount.e8s,
			counterparty: incoming ? operation.Transfer.from : operation.Transfer.to
		};
	}

	throw new Error(`Unknown transaction type ${JSON.stringify(transaction, jsonReplacer)}`);
};

export const mapTransactionIcrcToSelf = (tx: IcrcIndexDid.TransactionWithId): IcrcTransaction[] => {
	const { transaction, id } = tx;
	const { transfer: t } = transaction;

	const transfer = fromNullable(t);

	if (isNullish(transfer)) {
		return [
			{
				id,
				transaction
			}
		];
	}

	const { from, to } = transfer;

	const isSelfTransaction =
		encodeIcrcAccount(fromCandidAccount(from)).toLowerCase() ===
		encodeIcrcAccount(fromCandidAccount(to)).toLowerCase();

	return [
		{
			id,
			transaction: {
				...transaction,
				transferToSelf: 'send'
			}
		},
		...(isSelfTransaction
			? [
					{
						id,
						transaction: {
							...transaction,
							transferToSelf: 'receive' as const
						}
					}
				]
			: [])
	];
};

export const mapIcrcTransaction = ({
	transaction: { transaction, id },
	token,
	identity
}: {
	transaction: IcrcTransaction;
	token: Transaction['token'];
	identity: Identity;
}): Transaction => {
	const { timestamp, approve, burn, mint, transfer, transferToSelf } = transaction;

	const principal = identity.getPrincipal();

	const data =
		fromNullable(approve) ?? fromNullable(burn) ?? fromNullable(mint) ?? fromNullable(transfer);

	if (isNullish(data)) {
		throw new Error(`Unknown transaction type ${JSON.stringify(transaction, jsonReplacer)}`);
	}

	const accountIdentifier = nonNullish(identity)
		? encodeIcrcAccount(getIcrcAccount(identity.getPrincipal()))
		: undefined;

	const from = 'from' in data ? encodeIcrcAccount(fromCandidAccount(data.from)) : undefined;
	const to = 'to' in data ? encodeIcrcAccount(fromCandidAccount(data.to)) : undefined;

	const incoming =
		from?.toLowerCase() !== accountIdentifier?.toLowerCase() || transferToSelf === 'receive';

	const isApprove = nonNullish(fromNullable(approve));
	const isBurn = nonNullish(fromNullable(burn));
	const isMint = nonNullish(fromNullable(mint));

	const type = isApprove
		? 'Approve'
		: isBurn
			? 'Burn'
			: isMint
				? 'Mint'
				: incoming
					? 'Receive'
					: 'Send';

	const value = data?.amount;

	const approveData = fromNullable(approve);
	const approveSpender = nonNullish(approveData)
		? encodeIcrcAccount(fromCandidAccount(approveData.spender))
		: undefined;

	const counterparty = isApprove ? approveSpender : isBurn ? from : isMint || incoming ? from : to;

	return {
		id: `${id.toString()}${transferToSelf === 'receive' ? '-self' : ''}`,
		user: principal.toText(),
		timestamp,
		type,
		amount: value,
		token,
		counterparty,
		approveSpender
	};
};
