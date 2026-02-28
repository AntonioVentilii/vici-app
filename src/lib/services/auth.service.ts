/* eslint-disable require-await */

import { settleSeries } from '$lib/api/clearing.api';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import type { MarketId, Outcome } from '$lib/types/market';
import { binaryPayoff } from '$lib/utils/payoff.utils';
import { isNullish } from '@dfinity/utils';

export const isAdmin = async (): Promise<boolean> => true;

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

	try {
		// Trigger on-chain settlement
		await settleSeries({
			identity,
			params: {
				series_id: marketId,
				settlement_price: settlementPrice
			}
		});
	} catch (e: unknown) {
		console.error('Failed to settle series on-chain', e);
	}

	// TODO: retrigger the loading of markets to refresh the UI
};
