import { VXP_MIN_MAX_PAYOUT_VXP, VXP_STAKE_STEP_VXP } from '$lib/constants/vxp-trade.constants';
import { placeOrder } from '$lib/services/order.services';
import type { Market } from '$lib/types/market';
import type { OrderType } from '$lib/types/order';
import { isViciXp } from '$lib/utils/balance-domain.utils';
import {
	parseToken,
	parseUsdBaseUnitsFromDecimal,
	tokenBaseUnitsToUsdBaseUnits
} from '$lib/utils/parse.utils';
import { nonNullish } from '@dfinity/utils';

/**
 * @throws Error when premium or implied max payout breaks ViciXp sizing rules.
 */
export const assertViciXpHumanPremiumAndPayout = ({
	amountStr,
	executionPrice
}: {
	amountStr: string;
	executionPrice: number;
}): void => {
	const finalPrice = Math.max(executionPrice, 0.01);

	const premiumHuman = Number(String(amountStr).trim());

	if (
		!Number.isFinite(premiumHuman) ||
		premiumHuman < VXP_STAKE_STEP_VXP ||
		premiumHuman % VXP_STAKE_STEP_VXP !== 0 ||
		!Number.isInteger(premiumHuman)
	) {
		throw new Error(
			`VXP premium must be a whole amount of at least ${VXP_STAKE_STEP_VXP} in steps of ${VXP_STAKE_STEP_VXP}`
		);
	}

	const maxPayoutHuman = premiumHuman / finalPrice;

	if (!Number.isFinite(maxPayoutHuman) || maxPayoutHuman < VXP_MIN_MAX_PAYOUT_VXP) {
		throw new Error(
			`Potential payout if you win must be at least ${VXP_MIN_MAX_PAYOUT_VXP} VXP — raise the premium or adjust the price`
		);
	}
};

/**
 * Parameters for placing an outcome trade from the flow or manual UI.
 */
export interface TradeParams {
	market: Market;
	action: 'YES' | 'NO' | string;
	amount: string;
	orderType?: OrderType;
	/**
	 * Normalized limit price in `[0, 1]` when `orderType` is LIMIT.
	 */
	limitPrice?: number;
}

/**
 * Resolves execution probability (price of the bought outcome) for margin and VXP sizing checks.
 * Matches the path used by {@link executeOutcomeTrade} before `placeOrder` adjusts binary NO prices.
 */
export const resolveOutcomeExecutionPriceForSizing = ({
	market,
	action,
	orderType = 'MARKET',
	limitPrice
}: Pick<TradeParams, 'market' | 'action' | 'orderType' | 'limitPrice'>): number => {
	const computeExecutionPrice = (): number => {
		if (orderType === 'LIMIT' && nonNullish(limitPrice)) {
			return limitPrice;
		}

		if (action === 'YES') {
			return market.bestAsk ?? market.yesProbability;
		}

		if (action === 'NO') {
			return nonNullish(market.bestBid) ? 1 - market.bestBid : market.noProbability;
		}

		const outcome = market.outcomes?.find((o) => o.id === action);

		return outcome?.probability ?? 0.5;
	};

	return Math.max(computeExecutionPrice(), 0.01);
};

/**
 * Computes execution price and quantity, then submits a buy via `placeOrder`.
 */
export const executeOutcomeTrade = async ({
	market,
	action,
	amount,
	orderType = 'MARKET',
	limitPrice
}: TradeParams): Promise<void> => {
	const amountBase = parseToken({
		value: String(amount).trim(),
		unitName: market.token.decimals
	});

	const resolveOrderType = (): OrderType => {
		if (orderType === 'LIMIT' && nonNullish(limitPrice)) {
			return orderType;
		}

		if (action === 'YES') {
			return nonNullish(market.bestAsk) ? 'MARKET' : 'LIMIT';
		}

		if (action === 'NO') {
			return nonNullish(market.bestBid) ? 'MARKET' : 'LIMIT';
		}

		return 'LIMIT';
	};

	const type = resolveOrderType();

	const finalPrice = resolveOutcomeExecutionPriceForSizing({
		market,
		action,
		orderType,
		limitPrice
	});

	if (isViciXp(market.balanceDomain)) {
		assertViciXpHumanPremiumAndPayout({ amountStr: String(amount), executionPrice: finalPrice });
	}

	// Clearing margin is `qty * price` in USD `USD_DECIMALS` (see `get_required_margin`). Convert
	// collateral from token base units to that USD scale (1 token ≈ 1 USD notionally for sizing).
	const amountUsd = tokenBaseUnitsToUsdBaseUnits({
		amount: amountBase,
		tokenDecimals: market.token.decimals
	});
	const priceUsd = parseUsdBaseUnitsFromDecimal(finalPrice);
	const qty = amountUsd / priceUsd;

	const isBinary = market.payoffType === 'Binary';

	await placeOrder({
		marketId: market.id,
		side: 'BUY',
		type,
		// For binary "NO", the protocol expects (1 - price) if we are effectively buying YES at a low price
		// Actually, placeOrder handles categorical normalization.
		// If binary and NO, price = 1 - finalPrice
		price: isBinary && action === 'NO' ? 1 - finalPrice : finalPrice,
		qty,
		outcome: action
	});
};
