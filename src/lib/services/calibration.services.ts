import type { RegistryDid } from '$declarations';
import { VICI_ENGINE_ID } from '$lib/constants/icdc.constants';
import { getMarkets } from '$lib/services/market.services';
import type { CalibrationCard } from '$lib/types/calibration';
import type { Market } from '$lib/types/market';

/**
 * Builds the Calibration practice deck: finalised Vici-engine binary
 * markets, outcome hidden until the user commits.
 *
 * Our normal market list does not scope by engine — the live Flow / Markets
 * surfaces show every engine's markets. Calibration is different: the
 * reward only mints for Vici-engine (`eng_0`) binary markets, so the deck
 * filters on `engineId` here to avoid arming the user on a card that the
 * server will always reject with `not_vici_market`.
 *
 * Inclusion gate (all must hold):
 * - `status === 'Resolved'` — only finalised markets have a knowable side;
 * - `engineId === VICI_ENGINE_ID` — matches the server's market gate;
 * - `payoffType === 'Binary'` — the only shape with a YES / NO call;
 * - `outcome` is `'YES'` or `'NO'` — a definite side. A resolved market
 *   whose settlement was a cancellation / undetermined outcome carries no
 *   binary side, so the server would return `outcome_undetermined`; we
 *   drop it from the deck rather than surface an un-scoreable card.
 *
 * Per-market dedupe (already-earned markets) is enforced server-side via
 * the award-doc key, returning `alreadyClaimed` — the practice surface
 * advances gracefully on that result rather than pre-excluding here, so
 * the deck never needs the user's full award history to build.
 */
export const getCalibrationDeck = async (): Promise<CalibrationCard[]> => {
	// The reward pays in VXP, so scope the deck to the ViciXp domain.
	const domain: RegistryDid.BalanceDomain = { ViciXp: null };
	const markets = await getMarkets(domain);

	return markets.filter(isCalibrationEligible).map((market) => ({ market }));
};

const isCalibrationEligible = (market: Market): boolean =>
	market.status === 'Resolved' &&
	market.engineId === VICI_ENGINE_ID &&
	market.payoffType === 'Binary' &&
	(market.outcome === 'YES' || market.outcome === 'NO');
