import { transfer as transferIcrc } from '$lib/api/icrc-ledger.api';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import type { IcSendParams } from '$lib/types/ic-send';
import type { Token } from '$lib/types/token';
import { isWeb2Backend } from '$lib/web2/backend-mode';
import { listWalletAssets, requestWalletWithdrawal } from '$lib/web2/client';
import { isNullish } from '@dfinity/utils';
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

/**
 * Backend-agnostic wallet send. On the default backend it is the user-signed
 * ICRC transfer. In web2 mode the funds are custodial, so the send becomes a
 * self-custody withdrawal request: the API executes the transfer from the
 * user's custodial account to the destination the user typed. Either way the
 * user hands over a destination and an amount and the tokens leave their
 * wallet balance.
 */

/** Localizable send failure: the UI translates `messageKey` (with `params`)
 * instead of showing service-built English, appending `detail` when the API
 * reported a concrete reason. */
export class SendTokenError extends Error {
	readonly messageKey: 'wallet.send.unavailable' | 'wallet.send.failed';
	readonly params?: Record<string, string>;
	readonly detail?: string;

	constructor({
		messageKey,
		params,
		detail
	}: {
		messageKey: 'wallet.send.unavailable' | 'wallet.send.failed';
		params?: Record<string, string>;
		detail?: string;
	}) {
		super(messageKey);
		this.messageKey = messageKey;
		this.params = params;
		this.detail = detail;
	}
}

export const sendToken = async ({
	token,
	to,
	amount
}: {
	token: Token;
	to: string;
	amount: bigint;
}): Promise<void> => {
	if (isWeb2Backend()) {
		// The wallet routes key assets by the custody catalog's own id, matched
		// here by symbol on the IC chain (the catalog mirrors the supported IC
		// tokens).
		const assets = await listWalletAssets();
		const asset = assets.find(
			({ chain, symbol, chainEnabled }) => chain === 'ic' && symbol === token.symbol && chainEnabled
		);

		if (isNullish(asset)) {
			throw new SendTokenError({
				messageKey: 'wallet.send.unavailable',
				params: { symbol: token.symbol }
			});
		}

		const withdrawal = await requestWalletWithdrawal({
			assetId: asset.id,
			amount,
			destination: to,
			selfCustody: true
		});

		// The API executes best-effort inline and reports the outcome on the
		// returned row (a failed execution refunds the hold), so a failure must
		// surface to the caller like a rejected transfer would.
		if (withdrawal.state === 'failed') {
			throw new SendTokenError({
				messageKey: 'wallet.send.failed',
				detail: withdrawal.failureReason ?? undefined
			});
		}

		return;
	}

	const identity = await safeGetIdentityOnce();

	await sendIc({ identity, to, amount, ledgerCanisterId: token.ledgerCanisterId });
};
