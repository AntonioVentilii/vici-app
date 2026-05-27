/**
 * Curated editorial subtitle lines for the 2026 World Cup tentpole
 * markets. Each entry is a short (≤ ~40 char) italic accent line that
 * sits below the question on the Flow front card — e.g.
 * "Hex contenders · 17.9 % favorite", "Mbappé peak years · always in
 * mix". Keyed by the canonical market id used in `getFlowQueue` and
 * the satellite metadata.
 *
 * Until the satellite exposes a per-market `subtitle` field on
 * `MarketMetadata`, FlowCard uses this map as the source of truth for
 * WC markets; non-WC markets without a curated entry simply hide
 * the subtitle row (the raw description belongs on the back card
 * under RESOLVES YES IF, not as front-card editorial copy).
 */

export const WC_MARKET_SUBTITLES: Readonly<Record<string, string>> = {
	// Classic WC markets — winners + flagship outcomes
	'wc-winner-brazil': 'Hex contenders · 17.9 % favorite',
	'wc-winner-spain': 'Defending Euro champ · talented core',
	'wc-winner-france': 'Mbappé peak years · always in mix',
	'wc-winner-argentina': 'Defending champs · post-Messi era starts',
	'wc-golden-boot': 'Last WC: 8 goals · runner-up',
	'wc-usa-quarter': 'Co-host advantage · best squad in years',
	'wc-over-3-final': 'Last 3 finals averaged 3.0',
	'wc-german-out-group': 'Did it in 2018, 2022 · unthinkable third',

	// Playful WC markets — meta / cultural beats
	'wc-neymar-dive': 'Brazil opens vs. Mexico · Mexico City',
	'wc-player-haircut': "Pogba mohawk '18 · always a contender",
	'wc-trophy-drop': "Hasn't happened since 1970 · overdue",
	'wc-coach-stands': 'Mourinho last did it in 2010',
	'wc-pitch-propose': 'Has happened twice in WC history',
	'wc-var-final': 'Stakes guarantee a check · 2022 did it',
	'wc-celebration': 'Tournament-defining moment incoming'
} as const;

/**
 * Resolve the curated subtitle for a market id. Returns `undefined`
 * when no curated entry exists — callers should hide the subtitle
 * row in that case.
 */
export const lookupWcMarketSubtitle = (marketId: string): string | undefined =>
	WC_MARKET_SUBTITLES[marketId];
