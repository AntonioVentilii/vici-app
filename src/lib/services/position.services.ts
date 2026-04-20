import type { RegistryDid } from '$declarations';
import { getPositions as getPositionsApi } from '$lib/api/clearing.api';
import { getIdentity } from '$lib/services/identity.services';
import { getMarkets } from '$lib/services/market.services';
import { loadWithCertification } from '$lib/services/query-update.services';
import type { MarketId } from '$lib/types/market';
import type { Position } from '$lib/types/position';
import { filterByMarketIds } from '$lib/utils/balance-domain.utils';
import { mapPositionData } from '$lib/utils/position.utils';
import { isNullish } from '@dfinity/utils';
import type { Identity } from '@icp-sdk/core/agent';

/**
 * Core positions fetch: threads identity + certified so it composes with
 * {@link loadPositions} / `queryAndUpdate`.
 */
const fetchPositions = async ({
	identity,
	certified,
	domain
}: {
	identity: Identity;
	certified: boolean;
	domain: RegistryDid.BalanceDomain;
}): Promise<Position[]> => {
	const [positions, markets] = await Promise.all([
		getPositionsApi({ identity, certified }),
		// getMarkets wraps its own certified update; we keep it certified here to
		// avoid tearing — positions are filtered by the currently visible markets.
		getMarkets(domain)
	]);

	const marketIds = new Set(markets.map((m) => m.id));

	return filterByMarketIds({ items: positions, marketIds }).map(mapPositionData);
};

/**
 * All positions for the signed-in user, limited to markets returned by {@link getMarkets}.
 *
 * Performs a single certified update. Prefer {@link loadPositions} for UI flows
 * that should render fast then upgrade to a certified result.
 */
export const getPositions = async (domain: RegistryDid.BalanceDomain): Promise<Position[]> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return [];
	}

	return fetchPositions({ identity, certified: true, domain });
};

/**
 * Callback-based variant of {@link getPositions}. No-op when the user is not
 * signed in (mirrors `getPositions` returning `[]`).
 */
export const loadPositions = async ({
	domain,
	onLoad,
	onUpdateError
}: {
	domain: RegistryDid.BalanceDomain;
	onLoad: (options: { certified: boolean; response: Position[] }) => void;
	onUpdateError?: (error: unknown) => void;
}): Promise<void> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return;
	}

	return loadWithCertification<Position[]>({
		identity,
		request: ({ certified, identity: reqIdentity }) =>
			fetchPositions({ identity: reqIdentity, certified, domain }),
		onLoad,
		onUpdateError
	});
};

/**
 * Positions for a single market id.
 *
 * Performs a single certified update. Prefer {@link loadPositionsForMarket}
 * for UI flows that should render fast then upgrade to a certified result.
 */
export const getPositionsForMarket = async (targetSeriesId: MarketId): Promise<Position[]> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return [];
	}

	return fetchPositionsForMarket({ identity, certified: true, marketId: targetSeriesId });
};

const fetchPositionsForMarket = async ({
	identity,
	certified,
	marketId
}: {
	identity: Identity;
	certified: boolean;
	marketId: MarketId;
}): Promise<Position[]> => {
	const positions = await getPositionsApi({ identity, certified });

	return positions.filter((p) => p.series_id === marketId).map(mapPositionData);
};

/**
 * Callback-based variant of {@link getPositionsForMarket}. No-op when the
 * user is not signed in.
 */
export const loadPositionsForMarket = async ({
	marketId,
	onLoad,
	onUpdateError
}: {
	marketId: MarketId;
	onLoad: (options: { certified: boolean; response: Position[] }) => void;
	onUpdateError?: (error: unknown) => void;
}): Promise<void> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return;
	}

	return loadWithCertification<Position[]>({
		identity,
		request: ({ certified, identity: reqIdentity }) =>
			fetchPositionsForMarket({ identity: reqIdentity, certified, marketId }),
		onLoad,
		onUpdateError
	});
};
