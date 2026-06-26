import type { ClearingDid } from '$declarations';
import { listSettledSeries, settleSeries as settleSeriesApi } from '$lib/api/clearing.api';
import { PRICE_DECIMALS, VICI_ORACLE_V1, ZERO } from '$lib/constants/app.constants';
import { ActivityType } from '$lib/enums/social';
import { UserRole } from '$lib/enums/user';
import { logActivity } from '$lib/services/activity.services';
import { getIdentityOrAnonymous, safeGetIdentityOnce } from '$lib/services/identity.services';
import { getProfile } from '$lib/services/profile.services';
import type { Outcome } from '$lib/types/market';
import { binaryPayoffLabel } from '$lib/utils/payoff.utils';
import { nowInBigIntNanoSeconds, toNullable } from '@dfinity/utils';
import type { Identity } from '@icp-sdk/core/agent';

/**
 * Fetches the authoritative set of settled (resolved) series ids from the
 * clearing canister — the single source of truth for resolution.
 *
 * Front ends subtract this from the registry's open/unexpired catalog to
 * derive the open set (open = unexpired − settled), replacing the older,
 * incomplete reconstruction that scanned the global ACTIVITIES log for
 * settlement events. Optionally scope to one `balance_domain` so a single
 * deck only pays for its relevant subset.
 *
 * Threads `identity` + `certified` so it composes with `queryAndUpdate`; the
 * fast query path is the right default for read-only discovery, while the
 * value-bearing mint path validates correctness separately via
 * `get_settlement_status`.
 */
export const getSettledSeriesIds = async ({
	identity,
	certified = false,
	balanceDomain
}: {
	identity?: Identity;
	certified?: boolean;
	balanceDomain?: ClearingDid.BalanceDomain;
} = {}): Promise<Set<string>> => {
	const resolvedIdentity = identity ?? (await getIdentityOrAnonymous());

	// Clearing rejects anonymous callers on `list_settled_series` (IC0406), so a
	// signed-out / guest preview can't read the settled set. Degrade to an empty
	// set rather than throwing: the open list is already expiry-filtered, so the
	// guest deck simply skips the (resolved-but-unexpired) settled filter — an
	// acceptable preview trade-off, and the authoritative filter still applies
	// for every authenticated read.
	if (resolvedIdentity.getPrincipal().isAnonymous()) {
		return new Set();
	}

	const ids = await listSettledSeries({
		identity: resolvedIdentity,
		certified,
		params: {
			start_after: toNullable(),
			limit: toNullable(),
			balance_domain: toNullable(balanceDomain)
		}
	});

	return new Set(ids);
};

/**
 * Admin/resolver-only: settles a series on clearing by outcome id or numeric price and logs activity.
 *
 * **`settlementPrice` contract:** must be a bigint already scaled to
 * {@link PRICE_DECIMALS}. E.g. $1.00 ⇒ `100n`, $0.00 ⇒ `0n`. Callers that
 * start from a human-entered string should use `parseToken({ value, unitName:
 * PRICE_DECIMALS })`. Passing a value scaled to a different unit (such as the
 * collateral ledger's `token.decimals`) will silently settle at the wrong
 * price; binary YES/NO happens to work because clearing treats any `price > 0`
 * as YES, but any non-binary case would be off by a factor of 10.
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
	/**
	 * Settlement price as a bigint in {@link PRICE_DECIMALS} base units (e.g.
	 * `100n` for `$1.00` when `PRICE_DECIMALS === 2`).
	 */
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
