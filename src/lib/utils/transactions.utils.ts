import { ZERO } from '$lib/constants/app.constants';
import type { IcpTransaction, IcTransactionAddOnsInfo } from '$lib/types/ic-transaction';
import type { Transaction } from '$lib/types/wallet';
import { fromNullable, isNullish, jsonReplacer, nonNullish } from '@dfinity/utils';
import { type IcpIndexDid, AccountIdentifier } from '@icp-sdk/canisters/ledger/icp';
import {
	type IcrcIndexDid,
	encodeIcrcAccount,
	fromCandidAccount
} from '@icp-sdk/canisters/ledger/icrc';
import type { Identity } from '@icp-sdk/core/agent';
import type { Principal } from '@icp-sdk/core/principal';

export const getAccountIdentifier = (principal: Principal): AccountIdentifier =>
	AccountIdentifier.fromPrincipal({ principal, subAccount: undefined });

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
			type: incoming === false ? 'Send' : 'Receive',
			amount: operation.Transfer.amount.e8s,
			counterparty: incoming === false ? operation.Transfer.to : operation.Transfer.from
		};
	}

	throw new Error(`Unknown transaction type ${JSON.stringify(transaction, jsonReplacer)}`);
};

export const mapIcrcTransaction = ({
	transaction: { transaction, id },
	token,
	identity
}: {
	transaction: IcrcIndexDid.TransactionWithId;
	token: Transaction['token'];
	identity: Identity;
}): Transaction => {
	const { timestamp, transfer } = transaction;

	const data = fromNullable(transfer);

	if (isNullish(data)) {
		throw new Error(`Unknown transaction type ${JSON.stringify(transaction, jsonReplacer)}`);
	}

	const principal = identity.getPrincipal();

	const accountIdentifier = nonNullish(identity)
		? encodeIcrcAccount({ owner: principal })
		: undefined;

	const mapFrom = (from: string) => ({
		from,
		incoming: from?.toLowerCase() !== accountIdentifier?.toLowerCase()
	});

	const source = {
		...('from' in data ? mapFrom(encodeIcrcAccount(fromCandidAccount(data.from))) : {})
	};

	const type = source.incoming === false ? 'Send' : 'Receive';

	const value = data.amount;

	return {
		id: id.toString(),
		user: principal.toText(),
		timestamp,
		type,
		amount: value,
		token
	};
};
