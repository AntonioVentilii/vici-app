import type { ClearingDid } from '$declarations';
import { settleSeries } from '$lib/api/clearing.api';
import { PRICE_DECIMALS, VICI_ORACLE_V1 } from '$lib/constants/app.constants';
import { logActivity } from '$lib/services/activity.services';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import type { MarketId, Outcome } from '$lib/types/market';
import { ActivityType } from '$lib/types/social';
import { binaryPayoff } from '$lib/utils/payoff.utils';
import { refreshMarkets } from '$lib/utils/refresh.utils';
import { isNullish, nowInBigIntNanoSeconds, toNullable } from '@dfinity/utils';

export const resolveMarket = async ({
	marketId,
	outcome
}: {
	marketId: MarketId;
	outcome: Outcome;
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	const settlementPrice = binaryPayoff(outcome);

	if (isNullish(settlementPrice)) {
		throw new Error('Market cancellation not implemented yet');
	}

	const params: ClearingDid.SettleSeriesParams = {
		series_id: marketId,
		settlement: {
			Price: {
				decimal: {
					value: settlementPrice,
					decimals: PRICE_DECIMALS
				},
				timestamp: toNullable(nowInBigIntNanoSeconds()),
				oracle_id: toNullable(VICI_ORACLE_V1)
			}
		}
	};

	try {
		// Trigger on-chain settlement
		await settleSeries({
			identity,
			params
		});

		// Record resolution in Juno for UI persistence
		await logActivity({
			type: ActivityType.SETTLEMENT,
			user: identity.getPrincipal().toText(),
			marketId,
			title: `Market Resolved: ${outcome}`,
			// TODO: parse with built-in bigint instead of string
			details: JSON.stringify({ outcome, price: settlementPrice.toString() })
		});
	} catch (e: unknown) {
		console.error('Failed to settle series on-chain', e);
	}

	// Trigger UI refresh
	refreshMarkets();
};
