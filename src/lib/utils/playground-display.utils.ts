import type { ClearingDid } from '$declarations';
import { USD_DECIMALS, ZERO } from '$lib/constants/app.constants';
import {
	PLAYGROUND_CLEARING_MARGIN_DECIMALS,
	PLAYGROUND_DISPLAY_SYMBOL,
	VXP_BALANCE_DISPLAY_DECIMALS
} from '$lib/constants/playground.constants';
import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
import { formatAvailableUsd, formatToken, groupIntegerPart } from '$lib/utils/format.utils';

/**
 * Plain VXP balance — whole-number "points" feel with thousands separators
 * (e.g. `24,000`). Defaults to native VXP ledger decimals; pass `decimals`
 * when formatting a value already scaled to a different unit (e.g. clearing
 * margin units). No symbol — callers add `VXP` / `PLAYGROUND_DISPLAY_SYMBOL`
 * themselves so the same helper works for both display contexts.
 */
export const formatVxpBalance = ({
	value,
	decimals = VXP_TOKEN.decimals
}: {
	value: bigint;
	decimals?: number;
}): string =>
	formatToken({
		value,
		unitName: decimals,
		displayDecimals: VXP_BALANCE_DISPLAY_DECIMALS
	});

/**
 * Clearing-margin units → `24,000 VXP` (playground display). Uses the
 * shared {@link formatVxpBalance} so grouping / display decimals stay in
 * lock-step with non-playground VXP surfaces.
 */
export const formatPlaygroundClearingAsVxp = (value: bigint): string =>
	`${formatVxpBalance({ value, decimals: PLAYGROUND_CLEARING_MARGIN_DECIMALS })} ${PLAYGROUND_DISPLAY_SYMBOL}`;

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

export const formatPositionPnLWithOptionalUnit = ({
	pnl,
	playground
}: {
	pnl: number;
	playground: boolean;
}): string => {
	const core = `${pnl >= 0 ? '+' : ''}${groupIntegerPart({ formatted: pnl.toFixed(2) })}`;

	return playground ? `${core} ${PLAYGROUND_DISPLAY_SYMBOL}` : core;
};
