import type { ClearingDid } from '$declarations';
import { USD_DECIMALS, ZERO } from '$lib/constants/app.constants';
import {
	PLAYGROUND_CLEARING_MARGIN_DECIMALS,
	PLAYGROUND_DISPLAY_SYMBOL,
	SETTLEMENT_LOCKED_CAPACITY_LABEL
} from '$lib/constants/playground.constants';
import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
import type { LockedCapacityDisplayUnit } from '$lib/types/locked-capacity-display.types';
import type { Token } from '$lib/types/token';
import { formatAvailableUsd, formatCurrency, formatToken } from '$lib/utils/format.utils';

/** Playground (VXP) vs live settlement labels and amount formatting for portfolio and trade UI. */

/** Clearing 6-decimal scale shown as VXP 1:1 (no $). */
export const formatPlaygroundClearingAsVxp = (value: bigint): string =>
	formatCurrency({
		value,
		decimals: PLAYGROUND_CLEARING_MARGIN_DECIMALS,
		symbol: PLAYGROUND_DISPLAY_SYMBOL
	});

/** @deprecated Use `formatPlaygroundClearingAsVxp`; kept for existing imports. */
export const formatPlaygroundVxpAmount = formatPlaygroundClearingAsVxp;

/** Available margin for UI: VXP-style in playground, USD otherwise. */
export const formatAvailableMarginForUi = ({
	value,
	playground
}: {
	value: bigint;
	playground: boolean;
}): string => (playground ? formatPlaygroundClearingAsVxp(value) : formatAvailableUsd({ value }));

/** Native ICRC amount → clearing margin scale (`USD_DECIMALS`), same units as `total_equity_usd`. */
export const nativeToClearingMarginUnits = ({
	nativeBalance,
	nativeDecimals
}: {
	nativeBalance: bigint;
	nativeDecimals: number;
}): bigint => {
	if (nativeDecimals <= USD_DECIMALS) {
		return nativeBalance * 10n ** BigInt(USD_DECIMALS - nativeDecimals);
	}
	return nativeBalance / 10n ** BigInt(nativeDecimals - USD_DECIMALS);
};

const sumAssetWorthValueUsd = (assets: ClearingDid.AssetWorth[]): bigint =>
	assets.reduce((sum, asset) => sum + asset.value_usd, ZERO);

/**
 * “Available” for simple wallet copy: collateral value at mark minus margin reserved for open activity.
 * Uses `assets[].value_usd` when present; otherwise `fallbackCollateralMarginUnits`.
 */
export const intuitiveAvailableMarginUsd = ({
	assets,
	totalEquityUsd,
	availableMarginUsd,
	fallbackCollateralMarginUnits
}: {
	assets: ClearingDid.AssetWorth[] | undefined;
	totalEquityUsd: bigint;
	availableMarginUsd: bigint;
	fallbackCollateralMarginUnits: bigint;
}): bigint => {
	const locked = totalEquityUsd - availableMarginUsd;
	const atMark =
		assets !== undefined && assets.length > 0
			? sumAssetWorthValueUsd(assets)
			: fallbackCollateralMarginUnits;
	return atMark > locked ? atMark - locked : ZERO;
};

/** Label for quick-bet chips: amount with VXP symbol or `$` prefix. */
export const quickBetChipLabel = ({
	amount,
	playground
}: {
	amount: string;
	playground: boolean;
}): string => (playground ? `${amount} ${PLAYGROUND_DISPLAY_SYMBOL}` : `$${amount}`);

/** Unit label for flow trade entry (VXP in playground, USD otherwise). */
export const flowTradeDenominationLabel = (playground: boolean): 'VXP' | 'USD' =>
	playground ? PLAYGROUND_DISPLAY_SYMBOL : 'USD';

/** Label for locked-capacity UI (VXP vs settlement unit). */
export const lockedCapacityDenominationLabel = (playground: boolean): LockedCapacityDisplayUnit =>
	playground ? PLAYGROUND_DISPLAY_SYMBOL : SETTLEMENT_LOCKED_CAPACITY_LABEL;

/** Suffix appended to potential-return figures in playground (space + VXP symbol) or empty. */
export const potentialReturnUnitSuffix = (playground: boolean): string =>
	playground ? ` ${PLAYGROUND_DISPLAY_SYMBOL}` : '';

/** Single-line portfolio P&L with optional VXP suffix. */
export const formatPortfolioPnLStatLine = ({
	totalPnL,
	playground
}: {
	totalPnL: number;
	playground: boolean;
}): string => {
	const core = `${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}`;
	return playground ? `${core} ${PLAYGROUND_DISPLAY_SYMBOL}` : core;
};

/** Portfolio holdings summary: VXP token amount or fiat token currency from a sample token. */
export const formatPortfolioHoldingsStatLine = ({
	playground,
	totalPortfolioValue,
	sampleToken
}: {
	playground: boolean;
	totalPortfolioValue: bigint;
	sampleToken?: Token;
}): string => {
	if (playground) {
		return `${formatToken({
			value: totalPortfolioValue,
			unitName: VXP_TOKEN.decimals,
			displayDecimals: 4
		})} ${PLAYGROUND_DISPLAY_SYMBOL}`;
	}
	const dec = sampleToken?.decimals ?? 8;
	const sym = sampleToken?.symbol ?? 'ICP';
	return formatCurrency({ value: totalPortfolioValue, decimals: dec, symbol: sym });
};

/** Position P&L string with optional VXP unit in playground mode. */
export const formatPositionPnLWithOptionalUnit = ({
	pnl,
	playground
}: {
	pnl: number;
	playground: boolean;
}): string => {
	const core = `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`;
	return playground ? `${core} ${PLAYGROUND_DISPLAY_SYMBOL}` : core;
};
