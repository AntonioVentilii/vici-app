import { ZERO } from '$lib/constants/app.constants';
import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
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
 * Shared VXP-holdings derivation for the current balance domain, used by the
 * Dash, Portfolio, and Wallet surfaces.
 *
 * All figures are in the clearing-margin scale (4 decimals). On the ViciXp
 * playground domain — where the collateral asset is VXP, pegged 1:1 to the
 * clearing unit and sharing the same 4 decimals — they are plain VXP base
 * units, no conversion needed. (The clearing canister names its fields
 * `*_usd` because it is asset-agnostic; that suffix is the engine's accounting
 * unit, not real dollars.) Values are base units; never compare or sum in
 * whole-VXP.
 */

// True until both source stores have loaded once (they reset to `undefined`
// on balance-domain switches too). While set, every figure below reads as a
// misleading 0 / wallet-only partial — surfaces should render a placeholder
// instead of a real-looking number.
export const vxpHoldingsNotInitialized: Readable<boolean> = derived(
	[collateralsStore, balancesStore],
	([$collateralsStore, $balancesStore]) => isNullish($collateralsStore) || isNullish($balancesStore)
);

// Raw VXP balance sitting in the user's ICRC ledger wallet (un-deposited).
// Trends toward ~0 as VXP is swept into the clearing canister as collateral.
// Kept as its own concept for the Wallet surface (ledger balance + the
// low-balance "recovery" gate); the Dash "available to bet" figure is
// `vxpSpendable`, which also counts deposited clearing collateral.
export const vxpFree: Readable<bigint> = derived(
	balancesStore,
	($balancesStore) => $balancesStore?.[VXP_TOKEN.id] ?? ZERO
);

interface Holdings {
	/**
	 * Spendable: every VXP the user holds — free in the wallet **and**
	 * deposited as clearing collateral — minus everything reserved for open
	 * positions and resting orders. The honest "available to bet" figure.
	 */
	spendable: bigint;
	/** Reserved for open positions **and** resting limit orders. */
	backed: bigint;
}

const holdings: Readable<Holdings> = derived(
	[collateralsStore, balancesStore, walletUiTokens],
	([$collateralsStore, $balancesStore, $walletUiTokens]): Holdings => {
		// Un-deposited wallet VXP — spendable too, since it is swept into
		// clearing when the user places a call.
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
			return { spendable: walletMargin, backed: ZERO };
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

		return { spendable: walletMargin + clearingFree, backed };
	}
);

// "Available to bet": wallet VXP + deposited clearing collateral, minus
// everything reserved for open positions and resting orders.
export const vxpSpendable: Readable<bigint> = derived(holdings, ($holdings) => $holdings.spendable);

// Reserved for open positions + resting orders (the "Backed" figure).
export const vxpBacked: Readable<bigint> = derived(holdings, ($holdings) => $holdings.backed);

// Total holdings = spendable + backed — everything the user owns in this
// domain (free + locked), in base units.
export const vxpHoldingsTotal: Readable<bigint> = derived(
	holdings,
	($holdings) => $holdings.spendable + $holdings.backed
);
