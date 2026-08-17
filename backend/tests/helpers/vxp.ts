// Shared plumbing for the VXP economy suites: a recording ledger stub in
// place of the treasury-signed ICRC client, so awards exercise the full
// pending/paid/failed machinery without any network.

import { isNullish, nonNullish } from '@dfinity/utils';
import { query } from '../../src/db/client';
import { setVxpLedgerProvider, type VxpLedger } from '../../src/vxp/payout';

export interface RecordedTransfer {
	owner: string;
	amount: bigint;
	fee?: bigint;
	memo?: string;
}

export interface LedgerStub {
	transfers: RecordedTransfer[];
	restore: () => void;
}

let nextBlock = BigInt(1);

/**
 * Installs a stub ledger. `transferImpl` may throw per call (BadFee tests);
 * the default acknowledges every transfer with an increasing block index.
 * `balance` feeds the recovery-floor gates.
 */
export const stubVxpLedger = ({
	transferImpl,
	balance
}: {
	transferImpl?: (call: RecordedTransfer, callIndex: number) => Promise<bigint>;
	balance?: () => Promise<bigint>;
} = {}): LedgerStub => {
	const transfers: RecordedTransfer[] = [];

	const ledger: VxpLedger = {
		transfer: (params) => {
			const call: RecordedTransfer = {
				owner: params.to.owner.toText(),
				amount: params.amount,
				fee: params.fee,
				memo: nonNullish(params.memo) ? new TextDecoder().decode(params.memo) : undefined
			};

			transfers.push(call);

			if (isNullish(transferImpl)) {
				nextBlock += BigInt(1);

				return Promise.resolve(nextBlock);
			}

			return transferImpl(call, transfers.length - 1);
		},
		balance: () => (isNullish(balance) ? Promise.resolve(BigInt(0)) : balance())
	};

	const restore = setVxpLedgerProvider(() => Promise.resolve(ledger));

	return { transfers, restore };
};

/** The stored award row for direct assertions on status transitions. */
export const readAwardRow = async ({
	userId,
	awardType,
	awardKey
}: {
	userId: string;
	awardType: string;
	awardKey: string;
}): Promise<
	| {
			status: string;
			amount_base_units: string;
			block_index: string | null;
			error_message: string | null;
	  }
	| undefined
> => {
	const rows = await query<{
		status: string;
		amount_base_units: string;
		block_index: string | null;
		error_message: string | null;
	}>(
		`select status, amount_base_units, block_index, error_message
		 from vxp_awards where user_id = $1 and award_type = $2 and award_key = $3`,
		[userId, awardType, awardKey]
	);

	return rows[0];
};
