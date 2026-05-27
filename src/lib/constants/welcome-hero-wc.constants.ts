/**
 * Landing-only World Cup hero fixtures — feed the `WelcomeHeroDeck`
 * stacked-card visual. The on-product onboarding deck never surfaces
 * tentpole `wc` markets (see `WELCOME_MARKET_PREVIEWS` which
 * statically excludes the `wc` category), so these stay isolated to
 * the public hero surface.
 *
 * The shape mirrors the prototype's `data.js` World Cup fixtures: a
 * favourite team probability + total volume + close date drive the
 * faithful Trickster pill, callers pulse, predictors+delta, and
 * probability split rendered by `WelcomeHeroFlowCard.svelte`.
 *
 * `yesProbability` is the source of truth (0–1). `yesPercent` is the
 * pre-rounded integer the hero surface displays directly.
 */
export interface WelcomeHeroWcMarket {
	readonly id: string;
	// Pinned to the `wc` category so downstream renderers (header tint,
	// rich figure SVG) branch deterministically. Defined as a literal
	// — these fixtures don't generalize to other categories.
	readonly category: 'wc';
	readonly question: string;
	readonly yesProbability: number;
	readonly yesPercent: number;
	readonly closesLabel: string;
	readonly days: number;
	// Total predictors on this market — formatted via
	// `toLocaleString()` on render so the comma separator follows the
	// active locale (e.g. `1,240` in en-US, `1.240` in de-DE).
	readonly predictors: number;
	// New predictors in the last 24h. Surfaced in `yes`-green next to
	// the predictor count.
	readonly deltaToday: number;
	// Pulse pill copy — callers in the last hour. Drives the
	// "412 callers in last hour" rendered below the Trickster pill.
	readonly callersLastHour: number;
	// Serif-italic accent line beneath the question. Editorial copy —
	// keep it short, evocative; mirrors the prototype's "Hex contenders
	// · {favoritePct}% favorite" treatment.
	readonly accentCtx: string;
	// Brazil-specific figure flag. The hero card renders the rich
	// player SVG only when `hasFigure === true`; back cards (Spain /
	// France) reuse the existing FlowArt fallback band so the visual
	// hierarchy stays Brazil-first.
	readonly hasFigure: boolean;
}

const heroMarket = ({
	id,
	question,
	yesProbability,
	closesLabel,
	days,
	predictors,
	deltaToday,
	callersLastHour,
	accentCtx,
	hasFigure = false
}: {
	id: string;
	question: string;
	yesProbability: number;
	closesLabel: string;
	days: number;
	predictors: number;
	deltaToday: number;
	callersLastHour: number;
	accentCtx: string;
	hasFigure?: boolean;
}): WelcomeHeroWcMarket => ({
	id,
	category: 'wc',
	question,
	yesProbability,
	yesPercent: Math.round(yesProbability * 100),
	closesLabel,
	days,
	predictors,
	deltaToday,
	callersLastHour,
	accentCtx,
	hasFigure
});

/**
 * Three-card hero deck for the `/welcome` (signed-out) and `/about`
 * landing surfaces. Front card (depth 0) is the Brazil tentpole — the
 * only entry that renders the rich player figure. Spain + France sit
 * behind it as visual depth.
 *
 * Day counts assume a 2026-05-27 reference snapshot (matches `CLAUDE.md`
 * `currentDate`); the July 19 2026 close is ~53 days out at that
 * snapshot. We freeze the values for visual stability — the hero card
 * is decorative, so the chip never has to mutate.
 */
export const WELCOME_HERO_WC_MARKETS: readonly WelcomeHeroWcMarket[] = [
	heroMarket({
		id: 'wc-brazil-2026',
		question: 'Will Brazil win the 2026 World Cup?',
		yesProbability: 0.18,
		closesLabel: 'July 19 2026',
		days: 21,
		predictors: 1_240,
		deltaToday: 73,
		callersLastHour: 412,
		accentCtx: 'Hex contenders · 17.9% favorite',
		hasFigure: true
	}),
	heroMarket({
		id: 'wc-spain-2026',
		question: 'Will Spain win the 2026 World Cup?',
		yesProbability: 0.15,
		closesLabel: 'July 19 2026',
		days: 21,
		predictors: 980,
		deltaToday: 52,
		callersLastHour: 318,
		accentCtx: 'Hex contenders · 14.6% favorite'
	}),
	heroMarket({
		id: 'wc-france-2026',
		question: 'Will France win the 2026 World Cup?',
		yesProbability: 0.14,
		closesLabel: 'July 19 2026',
		days: 21,
		predictors: 875,
		deltaToday: 41,
		callersLastHour: 287,
		accentCtx: 'Hex contenders · 13.8% favorite'
	})
] as const;
