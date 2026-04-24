import type { ClearingDid } from '$declarations';
import { settleSeries as settleSeriesApi } from '$lib/api/clearing.api';
import { PRICE_DECIMALS, VICI_ORACLE_V1, ZERO } from '$lib/constants/app.constants';
import { ActivityType } from '$lib/enums/social';
import { UserRole } from '$lib/enums/user';
import { logActivity } from '$lib/services/activity.services';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import { getProfile } from '$lib/services/profile.services';
import type { Outcome } from '$lib/types/market';
import { binaryPayoffLabel } from '$lib/utils/payoff.utils';
import { nowInBigIntNanoSeconds, toNullable } from '@dfinity/utils';

/**
 * Admin/resolver-only: settles a series on clearing by outcome id or numeric price and logs activity.
 *
 * The activity `details` field is stringified JSON so downstream market loaders
 * (`fetchMarkets` / `fetchMarket`) can deserialize it into `{ outcome, price }`
 * and surface the winning outcome on resolved markets. Writing plain strings here
 * caused the detail page to show "Resolved" without a winner.
 */
export const settleMarket = async ({
	seriesId,
	settlementPrice,
	outcomeId
}: {
	seriesId: string;
	settlementPrice?: bigint;
	outcomeId?: string;
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	const profileDoc = await getProfile(identity.getPrincipal().toText());

	if (profileDoc.data.role !== UserRole.ADMIN && profileDoc.data.role !== UserRole.SOLVER) {
		throw new Error('Unauthorized: only admins or solvers can settle markets');
	}

	const priceValue = settlementPrice ?? ZERO;

	const params: ClearingDid.SettleSeriesParams = {
		series_id: seriesId,
		settlement: outcomeId
			? { Outcome: outcomeId }
			: {
					Price: {
						decimal: {
							value: priceValue,
							decimals: PRICE_DECIMALS
						},
						timestamp: toNullable(nowInBigIntNanoSeconds()),
						oracle_id: toNullable(VICI_ORACLE_V1)
					}
				}
	};

	await settleSeriesApi({
		identity,
		params
	});

	const outcome: Outcome | undefined = outcomeId ?? binaryPayoffLabel(priceValue);

	await logActivity({
		type: ActivityType.SETTLEMENT,
		user: identity.getPrincipal().toText(),
		marketId: seriesId,
		title: `Market Resolved: ${outcome ?? 'settled'}`,
		details: JSON.stringify({
			outcome,
			price: priceValue.toString()
		})
	});
};
