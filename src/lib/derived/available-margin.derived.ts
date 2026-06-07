import { ZERO } from '$lib/constants/app.constants';
import { walletUiTokens } from '$lib/derived/tokens.derived';
import { balancesStore } from '$lib/stores/balances.store';
import { collateralsStore } from '$lib/stores/collaterals.store';
import { icrcLedgerDecimalsFromCollateralConfig } from '$lib/utils/asset-ref.utils';
import {
	intuitiveAvailableMarginUsd,
	nativeToClearingMarginUnits
} from '$lib/utils/playground-display.utils';
import { isNullish } from '@dfinity/utils';
import { derived, type Readable } from 'svelte/store';

/**
 * Holdings breakdown for the current balance domain.
 *
 * All three figures are in the clearing-margin scale (4 decimals). On the
 * ViciXp playground domain — where the collateral asset is VXP, pegged 1:1 to
 * the clearing unit and sharing the same 4 decimals — they are plain VXP
 * amounts in base units, no conversion needed. (The clearing canister names
 * its fields `*_usd` because it is asset-agnostic; that suffix is the engine's
 * accounting unit, not real dollars.)
 */
export interface MarginSummary {
	/**
	 * Spendable: every VXP the user holds — free in the wallet **and**
	 * deposited as clearing collateral — minus everything reserved for open
	 * positions and resting orders. The honest "available to bet" figure.
	 */
	available: bigint;
	/** Reserved for open positions **and** resting limit orders. */
	backed: bigint;
	/** `available + backed` — everything the user holds in this domain. */
	total: bigint;
}

/**
 * Single source of truth shared by the Trade modal and the Dashboard so the
 * "how much can I stake right now?" figure is identical across surfaces.
 */
export const marginSummary: Readable<MarginSummary> = derived(
	[collateralsStore, balancesStore, walletUiTokens],
	([$collateralsStore, $balancesStore, $walletUiTokens]): MarginSummary => {
		// Un-deposited VXP still sitting in the wallet — spendable too, since it
		// is swept into clearing when the user places a call.
		let walletMargin = ZERO;

		for (const token of $walletUiTokens) {
			const walletBalance = $balancesStore?.[token.id] ?? ZERO;

			if (walletBalance > ZERO) {
				walletMargin += nativeToClearingMarginUnits({
					nativeBalance: walletBalance,
					nativeDecimals: token.decimals
				});
			}
		}

		const account = $collateralsStore?.accountState;

		// No clearing account yet (e.g. a fresh user who hasn't deposited): all
		// they can stake is whatever sits in the wallet.
		if (isNullish($collateralsStore) || isNullish(account)) {
			return { available: walletMargin, backed: ZERO, total: walletMargin };
		}

		// Clearing collateral raw balances — the mark-value fallback used when
		// the account carries no priced `assets`.
		let clearingFallback = ZERO;

		for (const token of $walletUiTokens) {
			const balance = $collateralsStore.balances[token.id] ?? ZERO;

			if (balance > ZERO) {
				const decimals = icrcLedgerDecimalsFromCollateralConfig({
					assetsConfig: $collateralsStore.assetsConfig ?? {},
					ledgerCanisterId: token.ledgerCanisterId,
					fallbackDecimals: token.decimals
				});
				clearingFallback += nativeToClearingMarginUnits({
					nativeBalance: balance,
					nativeDecimals: decimals
				});
			}
		}

		const clearingFree = intuitiveAvailableMarginUsd({
			assets: account.assets,
			totalEquityUsd: account.total_equity_usd,
			availableMarginUsd: account.available_margin_usd,
			fallbackCollateralMarginUnits: clearingFallback
		});

		// Reserved for open positions + resting orders.
		const backed =
			account.total_equity_usd > account.available_margin_usd
				? account.total_equity_usd - account.available_margin_usd
				: ZERO;

		const available = walletMargin + clearingFree;

		return { available, backed, total: available + backed };
	}
);
