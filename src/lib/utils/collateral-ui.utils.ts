import { ZERO } from '$lib/constants/app.constants';
import { VXP_BALANCE_DISPLAY_DECIMALS } from '$lib/constants/playground.constants';
import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
import type { CollateralStoreData } from '$lib/stores/collaterals.store';
import type { Token } from '$lib/types/token';
import { icrcLedgerDecimalsFromCollateralConfig } from '$lib/utils/asset-ref.utils';
import { formatToken } from '$lib/utils/format.utils';
import {
	intuitiveAvailableMarginUsd,
	nativeToClearingMarginUnits
} from '$lib/utils/playground-display.utils';
import { isNullish } from '@dfinity/utils';

export const calculateDepositedNominalLabel = ({
	collateral,
	tokens
}: {
	collateral: CollateralStoreData;
	tokens: Token[];
}): string => {
	const parts: string[] = [];

	for (const t of tokens) {
		const b = collateral.balances[t.id] ?? ZERO;

		if (b !== ZERO) {
			const d = icrcLedgerDecimalsFromCollateralConfig({
				assetsConfig: collateral.assetsConfig,
				ledgerCanisterId: t.ledgerCanisterId,
				fallbackDecimals: t.decimals
			});

			const displayDecimals =
				t.symbol === VXP_TOKEN.symbol ? VXP_BALANCE_DISPLAY_DECIMALS : undefined;

			parts.push(`${formatToken({ value: b, unitName: d, displayDecimals })} ${t.symbol}`);
		}
	}

	return parts.join(' · ');
};

export const calculateFallbackCollateralMarginUnits = ({
	collateral,
	tokens
}: {
	collateral: CollateralStoreData;
	tokens: Token[];
}): bigint => {
	let total = ZERO;

	for (const t of tokens) {
		const b = collateral.balances[t.id] ?? ZERO;

		if (b > ZERO) {
			const d = icrcLedgerDecimalsFromCollateralConfig({
				assetsConfig: collateral.assetsConfig,
				ledgerCanisterId: t.ledgerCanisterId,
				fallbackDecimals: t.decimals
			});

			total += nativeToClearingMarginUnits({
				nativeBalance: b,
				nativeDecimals: d
			});
		}
	}

	return total;
};

export const calculateIntuitiveAvailable = ({
	collateral,
	tokens
}: {
	collateral: CollateralStoreData;
	tokens: Token[];
}): bigint | undefined => {
	const a = collateral.accountState;

	if (isNullish(a)) {
		return undefined;
	}

	const fallbackCollateralMarginUnits = calculateFallbackCollateralMarginUnits({
		collateral,
		tokens
	});

	return intuitiveAvailableMarginUsd({
		assets: a.assets,
		totalEquityUsd: a.total_equity_usd,
		availableMarginUsd: a.available_margin_usd,
		fallbackCollateralMarginUnits
	});
};
