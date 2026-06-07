import { ZERO } from '$lib/constants/app.constants';
import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
import { markets } from '$lib/derived/markets.derived';
import { positions } from '$lib/derived/positions.derived';
import { balancesStore } from '$lib/stores/balances.store';
import { derived, type Readable } from 'svelte/store';

/**
 * Shared "total VXP holdings = free wallet balance + backed collateral"
 * derivation, used by the Dash, Portfolio, and Wallet surfaces.
 *
 * All three legs share a 4-decimal scale (`VXP_TOKEN.decimals` ==
 * `USD_DECIMALS`, the scale `lockedCollateral` is denominated in), so the
 * raw bigints add directly — callers format with `formatVxpBalance` only
 * at display time. Values are base units; never compare or sum in
 * whole-VXP.
 */

// Free VXP balance in the user's ICRC ledger account. Drops toward zero as
// VXP moves into the clearing canister as collateral, so a user with many
// active positions can show ~0 here despite owning plenty — the headline
// "Total Holdings" number must combine this with `vxpBacked`.
export const vxpFree: Readable<bigint> = derived(
	balancesStore,
	($balancesStore) => $balancesStore?.[VXP_TOKEN.id] ?? ZERO
);

// Backed = sum of locked collateral across the user's active positions on
// VXP-denominated markets. `lockedCollateral` is in clearing-USD micro-units
// (USD_DECIMALS = 4), matching `VXP_TOKEN.decimals`, so no conversion is
// needed.
export const vxpBacked: Readable<bigint> = derived(
	[positions, markets],
	([$positions, $markets]) => {
		const marketById = new Map($markets.map((m) => [m.id, m] as const));

		return $positions.reduce<bigint>((acc, pos) => {
			const market = marketById.get(pos.marketId);

			if (market === undefined || market.token.symbol !== VXP_TOKEN.symbol) {
				return acc;
			}

			return acc + pos.lockedCollateral;
		}, ZERO);
	}
);

// Total holdings = free wallet balance + backed collateral, in base units.
export const vxpHoldingsTotal: Readable<bigint> = derived(
	[vxpFree, vxpBacked],
	([$vxpFree, $vxpBacked]) => $vxpFree + $vxpBacked
);
