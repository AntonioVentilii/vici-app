// Treasury-signed VXP ledger access behind an injectable provider, so award
// logic and tests never touch the network directly. The transfer path retries
// once on BadFee with the ledger-reported expected fee, the only rejection
// worth an automatic second attempt; every other case is terminal.

import { isNullish, jsonReplacer, nonNullish } from '@dfinity/utils';
import { IcrcLedgerCanister, IcrcTransferError } from '@icp-sdk/canisters/ledger/icrc';
import { Principal } from '@icp-sdk/core/principal';
import { getAssetBySymbol } from '../custody/assets';
import { buildAgent } from '../lib/ic-agent';
import { treasuryIcIdentity, userIcPrincipalText } from '../lib/keys';

/** The slice of the ICRC ledger client the payout path uses. Mirrors the
 * canister client's own method shapes so the default provider is a plain
 * pass-through and tests can hand in a stub. */
export interface VxpLedger {
	transfer: (params: {
		to: { owner: Principal; subaccount: [] };
		amount: bigint;
		fee?: bigint;
		memo?: Uint8Array;
	}) => Promise<bigint>;
	balance: (params: { owner: Principal; certified: boolean }) => Promise<bigint>;
}

export type VxpLedgerProvider = () => Promise<VxpLedger>;

const defaultLedgerProvider: VxpLedgerProvider = async () => {
	const asset = await getAssetBySymbol({ chain: 'ic', symbol: 'VXP' });

	if (isNullish(asset) || isNullish(asset.ledger_ref)) {
		throw new Error('VXP asset is not seeded with a ledger canister id');
	}

	const agent = await buildAgent(treasuryIcIdentity());

	return IcrcLedgerCanister.create({
		agent,
		canisterId: Principal.fromText(asset.ledger_ref)
	});
};

let ledgerProvider: VxpLedgerProvider = defaultLedgerProvider;

/** Test seam: swap the ledger for a stub; returns a restore function. */
export const setVxpLedgerProvider = (provider: VxpLedgerProvider): (() => void) => {
	const previous = ledgerProvider;

	ledgerProvider = provider;

	return () => {
		ledgerProvider = previous;
	};
};

interface TransferErrorVariant {
	BadFee?: { expected_fee: bigint };
	InsufficientFunds?: { balance: bigint };
}

const errorVariantOf = (err: unknown): TransferErrorVariant | undefined => {
	if (err instanceof IcrcTransferError) {
		const variant = err.errorType;

		if (nonNullish(variant) && typeof variant === 'object') {
			return variant as TransferErrorVariant;
		}
	}
};

/** Human-readable summary of a transfer rejection for logs and the stored
 * error_message: spells out the two cases routinely hit and falls back to a
 * JSON dump (or the message) for the rest. */
export const transferErrorText = (err: unknown): string => {
	const variant = errorVariantOf(err);

	if (nonNullish(variant?.InsufficientFunds)) {
		return `InsufficientFunds(balance=${variant.InsufficientFunds.balance})`;
	}

	if (nonNullish(variant?.BadFee)) {
		return `BadFee(expected_fee=${variant.BadFee.expected_fee})`;
	}

	if (nonNullish(variant)) {
		return JSON.stringify(variant, jsonReplacer);
	}

	return err instanceof Error ? err.message : String(err);
};

export type VxpTransferResult = { ok: true; blockIndex: string } | { ok: false; error: string };

/**
 * Treasury transfer of VXP base units to an owner principal, retrying once
 * with the ledger-reported expected_fee on a BadFee rejection. The memo is a
 * short tag string (e.g. vxp:streak:streak_7) encoded to bytes here so call
 * sites pass a plain string.
 */
export const transferVxpWithBadFeeRetry = async ({
	toOwner,
	amount,
	memo
}: {
	toOwner: Principal;
	amount: bigint;
	memo: string;
}): Promise<VxpTransferResult> => {
	const ledger = await ledgerProvider();
	const memoBytes = new TextEncoder().encode(memo);

	const tryTransfer = (fee?: bigint): Promise<bigint> =>
		ledger.transfer({
			to: { owner: toOwner, subaccount: [] },
			amount,
			...(nonNullish(fee) ? { fee } : {}),
			memo: memoBytes
		});

	try {
		return { ok: true, blockIndex: (await tryTransfer()).toString() };
	} catch (firstErr) {
		const badFee = errorVariantOf(firstErr)?.BadFee;

		if (isNullish(badFee)) {
			return { ok: false, error: transferErrorText(firstErr) };
		}

		try {
			return { ok: true, blockIndex: (await tryTransfer(badFee.expected_fee)).toString() };
		} catch (retryErr) {
			return { ok: false, error: transferErrorText(retryErr) };
		}
	}
};

/** Transfer to a user's custodial principal: in this stack the user's VXP
 * account IS their derived custodial IC principal. */
export const transferVxpToUser = ({
	userId,
	amount,
	memo
}: {
	userId: string;
	amount: bigint;
	memo: string;
}): Promise<VxpTransferResult> =>
	transferVxpWithBadFeeRetry({
		toOwner: Principal.fromText(userIcPrincipalText(userId)),
		amount,
		memo
	});

/** The user's spendable VXP balance (base units), read from the ledger. */
export const getVxpBalance = async (userId: string): Promise<bigint> => {
	const ledger = await ledgerProvider();

	return await ledger.balance({
		owner: Principal.fromText(userIcPrincipalText(userId)),
		certified: false
	});
};
