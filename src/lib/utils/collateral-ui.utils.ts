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
}): string =>
	tokens
		.map((t) => ({ token: t, balance: collateral.balances[t.id] ?? ZERO }))
		.filter(({ balance }) => balance !== ZERO)
		.map(({ token, balance }) => {
			const unitName = icrcLedgerDecimalsFromCollateralConfig({
				assetsConfig: collateral.assetsConfig,
				ledgerCanisterId: token.ledgerCanisterId,
				fallbackDecimals: token.decimals
			});
			const displayDecimals =
				token.symbol === VXP_TOKEN.symbol ? VXP_BALANCE_DISPLAY_DECIMALS : undefined;

			return `${formatToken({ value: balance, unitName, displayDecimals })} ${token.symbol}`;
		})
		.join(' · ');

export const calculateFallbackCollateralMarginUnits = ({
	collateral,
	tokens
}: {
	collateral: CollateralStoreData;
	tokens: Token[];
}): bigint =>
	tokens.reduce<bigint>((total, t) => {
		const b = collateral.balances[t.id] ?? ZERO;

		if (b <= ZERO) {
			return total;
		}

		const d = icrcLedgerDecimalsFromCollateralConfig({
			assetsConfig: collateral.assetsConfig,
			ledgerCanisterId: t.ledgerCanisterId,
			fallbackDecimals: t.decimals
		});

		return (
			total +
			nativeToClearingMarginUnits({
				nativeBalance: b,
				nativeDecimals: d
			})
		);
	}, ZERO);

export const calculateIntuitiveAvailable = ({
	collateral,
	tokens
}: {
	collateral: CollateralStoreData;
	tokens: Token[];
}): bigint | undefined => {
	const a = collateral.accountState;

	if (isNullish(a)) {
		return;
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
