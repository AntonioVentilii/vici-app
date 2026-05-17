import type { ClearingDid } from '$declarations';
import { USD_DECIMALS, ZERO } from '$lib/constants/app.constants';
import {
	PLAYGROUND_CLEARING_MARGIN_DECIMALS,
	PLAYGROUND_DISPLAY_SYMBOL,
	SETTLEMENT_LOCKED_CAPACITY_LABEL,
	VXP_BALANCE_DISPLAY_DECIMALS
} from '$lib/constants/playground.constants';
import {
	PORTFOLIO_DEFAULT_DECIMALS,
	PORTFOLIO_DEFAULT_SYMBOL
} from '$lib/constants/portfolio.constants';
import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
import type { LockedCapacityDisplayUnit } from '$lib/types/locked-capacity-display.types';
import type { Token } from '$lib/types/token';
import { formatAvailableUsd, formatCurrency, formatToken } from '$lib/utils/format.utils';

/**
 * VXP balances render as whole numbers (no fractional part) to reinforce the
 * "points" feel, even though the underlying clearing scale is 6 decimals.
 */
export const formatPlaygroundClearingAsVxp = (value: bigint): string =>
	`${formatToken({
		value,
		unitName: PLAYGROUND_CLEARING_MARGIN_DECIMALS,
		displayDecimals: VXP_BALANCE_DISPLAY_DECIMALS
	})} ${PLAYGROUND_DISPLAY_SYMBOL}`;

/** @deprecated Use {@link formatPlaygroundClearingAsVxp}. */
export const formatPlaygroundVxpAmount = formatPlaygroundClearingAsVxp;

export const formatAvailableMarginForUi = ({
	value,
	playground
}: {
	value: bigint;
	playground: boolean;
}): string => (playground ? formatPlaygroundClearingAsVxp(value) : formatAvailableUsd({ value }));

/**
 * Native ICRC amount → clearing margin scale (`USD_DECIMALS`), same units as `total_equity_usd`.
 */
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
 * "Available" margin for simple wallet copy: collateral value at mark minus
 * margin reserved for open activity. Uses `assets[].value_usd` when present;
 * otherwise `fallbackCollateralMarginUnits`.
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

export const quickBetChipLabel = ({
	amount,
	playground
}: {
	amount: string;
	playground: boolean;
}): string => (playground ? `${amount} ${PLAYGROUND_DISPLAY_SYMBOL}` : `$${amount}`);

export const flowTradeDenominationLabel = (playground: boolean): 'VXP' | 'USD' =>
	playground ? PLAYGROUND_DISPLAY_SYMBOL : 'USD';

export const lockedCapacityDenominationLabel = (playground: boolean): LockedCapacityDisplayUnit =>
	playground ? PLAYGROUND_DISPLAY_SYMBOL : SETTLEMENT_LOCKED_CAPACITY_LABEL;

export const potentialReturnUnitSuffix = (playground: boolean): string =>
	playground ? ` ${PLAYGROUND_DISPLAY_SYMBOL}` : '';

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
			displayDecimals: VXP_BALANCE_DISPLAY_DECIMALS
		})} ${PLAYGROUND_DISPLAY_SYMBOL}`;
	}

	const dec = sampleToken?.decimals ?? PORTFOLIO_DEFAULT_DECIMALS;
	const sym = sampleToken?.symbol ?? PORTFOLIO_DEFAULT_SYMBOL;

	return formatCurrency({ value: totalPortfolioValue, decimals: dec, symbol: sym });
};

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
