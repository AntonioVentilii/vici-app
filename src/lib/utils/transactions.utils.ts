import { ZERO } from '$lib/constants/app.constants';
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

export const mapIcpTransaction = ({
	transaction: { transaction, id },
	token,
	identity
}: {
	transaction: IcpIndexDid.TransactionWithId;
	token: Transaction['token'];
	identity: Identity;
}): Transaction => {
	const { operation, timestamp } = transaction;

	const principal = identity.getPrincipal();

	const accountIdentifier = nonNullish(identity)
		? getAccountIdentifier(identity.getPrincipal())
		: undefined;

	const mapFrom = (from: string) => ({
		from,
		incoming: from?.toLowerCase() !== accountIdentifier?.toHex().toLowerCase()
	});

	if ('Transfer' in operation) {
		const source = mapFrom(operation.Transfer.from);

		return {
			id: id.toString(),
			user: principal.toText(),
			timestamp: fromNullable(timestamp)?.timestamp_nanos ?? ZERO,
			type: source.incoming === false ? 'Send' : 'Receive',
			amount: operation.Transfer.amount.e8s,
			token
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
