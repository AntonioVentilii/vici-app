import { DAY_IN_MS, ZERO } from '$lib/constants/app.constants';
import type { AppLocale } from '$lib/constants/locale.constants';
import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
import type { FeaturedEvent, FeaturedEventParticipant } from '$lib/types/featured-event';
import type { Market } from '$lib/types/market';
import { t } from '$lib/utils/i18n.utils';
import { parseMarketId } from '$lib/validation/market.validation';
import { PrincipalTextSchema } from '@junobuild/schema';

/**
 * Synthesises the `Market` the onboarding first-call card binds to.
 *
 * The first call is a guided rehearsal of the in-product deck, so it has
 * to render through the real `FlowCard` — which expects a full `Market`,
 * not the trimmed advancement-market fixture the featured-event constant
 * ships. This helper widens that fixture into a complete `Market` shaped
 * exactly like a hydrated one so the card is pixel-identical to a live
 * deck card, without reaching the markets service (onboarding runs
 * pre-auth, before any market is hydrated).
 *
 * Two question modes mirror the team-pick branch:
 *   - Picked team → its advancement market ("Will {team} make the round
 *     of 16?") at the fixture's implied YES probability.
 *   - Skip / no advancement market → the participant's winner market
 *     ("Will {team} win the World Cup?") seeded off their long-odds.
 *
 * The synthetic id reuses the fixture's market id so the artwork seed and
 * any downstream lookup stay stable across renders.
 */

// Anonymous principal — the synthetic card has no real creator. A valid
// principal text is required by the `Market` shape; the value is never
// surfaced or used to settle anything.
const ANONYMOUS_CREATOR = PrincipalTextSchema.parse('2vxsx-fae');

// Marketing-only social-proof counts. Deterministic per market id so the
// "N predicting" line is stable across renders without a live aggregator
// — the same approach FlowCard already uses for its momentum fallback.
const seededPredictors = (id: string): number => {
	let hash = 0;

	for (let i = 0; i < id.length; i += 1) {
		hash = (hash * 31 + id.charCodeAt(i)) | 0;
	}

	return 1_200 + (Math.abs(hash) % 9_800);
};

export const buildOnboardingFirstCallMarket = ({
	event,
	participant,
	locale
}: {
	event: FeaturedEvent;
	participant: FeaturedEventParticipant | undefined;
	locale: AppLocale;
}): Market => {
	const advancement = participant ? event.advancementMarkets?.[participant.id] : undefined;

	// Title + probability source. Picked team with an advancement market
	// uses it directly; otherwise fall back to the winner market framed off
	// the participant's win-odds (already a 0–100 implied probability).
	const rawId =
		advancement?.id ??
		participant?.marketId ??
		participant?.id ??
		event.favouriteIds[0] ??
		event.id;

	const eventName = event.shortTitle ?? event.title;

	// `advancement.q` is the registry's advancement question — authored
	// upstream and not in our control to localise here, so it's used
	// verbatim when present. The two template fallbacks are ours, so they
	// route through `t()`; team and event names are proper nouns passed
	// through as interpolation params.
	const title =
		advancement?.q ??
		(participant
			? t({
					locale,
					key: 'onboarding.beat1b.winner_question',
					params: { participant: participant.name, event: eventName }
				})
			: t({
					locale,
					key: 'onboarding.beat1b.champion_question',
					params: { event: eventName }
				}));

	const yesPct = advancement?.yes ?? Math.max(5, Math.min(95, Math.round(participant?.odds ?? 50)));
	const yesProbability = Math.max(0.05, Math.min(0.95, yesPct / 100));

	const predictors = seededPredictors(rawId);
	const yesPredictors = Math.round((predictors * yesPct) / 100);
	const noPredictors = predictors - yesPredictors;

	const nowMs = Date.now();

	return {
		id: parseMarketId(rawId),
		title,
		description: title,
		resolution: title,
		creator: ANONYMOUS_CREATOR,
		expiryDate: BigInt(Math.trunc(event.finalAt_ms)),
		createdAt: BigInt(Math.trunc(nowMs - 7 * DAY_IN_MS)),
		status: 'Open',
		outcomes: [
			{ id: 'YES', title: 'YES', probability: yesProbability, totalPredictions: yesPredictors },
			{
				id: 'NO',
				title: 'NO',
				probability: 1 - yesProbability,
				totalPredictions: noPredictors
			}
		],
		payoffType: 'Binary',
		isInviteOnly: false,
		inviteList: [],
		tradingAccess: [{ type: 'Open' }],
		totalVolume: ZERO,
		yesVolume: ZERO,
		noVolume: ZERO,
		yesProbability,
		noProbability: 1 - yesProbability,
		token: VXP_TOKEN,
		pricePrecision: VXP_TOKEN.decimals,
		balanceDomain: { ViciXp: null }
	};
};
