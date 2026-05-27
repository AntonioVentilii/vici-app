/**
 * Landing-only mock data — markets + World Cup favourites.
 *
 * The landing surface is a pre-sign-in marketing page and does NOT
 * read live markets from the canister. These fixtures shape the
 * sections that render the curated marketing cards.
 */

export type LandingMarketCategory =
	| 'wc'
	| 'macro'
	| 'crypto'
	| 'politics'
	| 'tech'
	| 'sports'
	| 'culture';

export interface LandingMarket {
	readonly id: string;
	readonly cat: LandingMarketCategory;
	readonly q: string;
	readonly ctx: string;
	readonly yes: number;
	readonly vol: string;
	readonly liq: string;
	readonly closes: string;
	readonly days: number;
	readonly hot?: boolean;
	readonly predictors?: number;
}

/**
 * Markets deck — first three drive the Hero deck + Flow demo, first
 * six the Live Markets grid, first eight the ticker. The top card
 * (`wc-winner-brazil`) is `hot: true` and triggers the "trickster
 * pill" on the Hero card because `min(yes, no) < 25`.
 */
export const LANDING_MARKETS: readonly LandingMarket[] = [
	{
		id: 'wc-winner-brazil',
		cat: 'wc',
		q: 'Will Brazil win the 2026 World Cup?',
		ctx: 'Hex contenders · 17.9% favorite',
		yes: 18,
		vol: '4.2M',
		liq: '780K',
		closes: 'July 19, 2026',
		days: 90,
		hot: true,
		predictors: 1240
	},
	{
		id: 'wc-winner-spain',
		cat: 'wc',
		q: 'Will Spain win the 2026 World Cup?',
		ctx: 'Defending Euro champ · talented core',
		yes: 15,
		vol: '3.1M',
		liq: '620K',
		closes: 'July 19, 2026',
		days: 90,
		predictors: 980
	},
	{
		id: 'wc-winner-france',
		cat: 'wc',
		q: 'Will France win the 2026 World Cup?',
		ctx: 'Mbappé peak years · always in mix',
		yes: 14,
		vol: '3.8M',
		liq: '710K',
		closes: 'July 19, 2026',
		days: 90,
		predictors: 1120
	},
	{
		id: 'fed-jun',
		cat: 'macro',
		q: 'Will the Fed cut rates in June?',
		ctx: 'FOMC · rate-cut call',
		yes: 64,
		vol: '2.4M',
		liq: '480K',
		closes: 'June 18',
		days: 47,
		hot: true,
		predictors: 2410
	},
	{
		id: 'btc-150k',
		cat: 'crypto',
		q: 'Will BTC close above $150K by year-end?',
		ctx: 'Spot price $128.4K · 7d +4.2%',
		yes: 38,
		vol: '8.1M',
		liq: '1.2M',
		closes: 'Dec 31',
		days: 228,
		hot: true,
		predictors: 3210
	},
	{
		id: 'gpt6-2026',
		cat: 'tech',
		q: 'Will OpenAI release GPT-6 before Q4?',
		ctx: 'Last release: GPT-5.5 · Mar 2026',
		yes: 22,
		vol: '620K',
		liq: '180K',
		closes: 'Sep 30',
		days: 135,
		predictors: 1480
	},
	{
		id: 'sb-niners',
		cat: 'sports',
		q: 'Will the 49ers win the Super Bowl?',
		ctx: 'Currently 12-3 · favored by Vegas',
		yes: 31,
		vol: '1.8M',
		liq: '320K',
		closes: 'Feb 8',
		days: 266,
		predictors: 1820
	},
	{
		id: 'eu-ai-act',
		cat: 'politics',
		q: 'Will the EU pass the AI Liability Act this session?',
		ctx: 'Council vote pending · whip count tight',
		yes: 55,
		vol: '410K',
		liq: '90K',
		closes: 'Jul 12',
		days: 58,
		predictors: 980
	}
] as const;

/**
 * World Cup favourites — used by the WCFeature section's 2×2 flag
 * grid. `daysToKickoff` is derived from the repo's `WORLD_CUP_KICKOFF`
 * constant so the landing always shows the same countdown the rest of
 * the app uses.
 */
export interface LandingWcFavorite {
	readonly code: string;
	readonly team: string;
	readonly flag: string;
	readonly color: string;
	readonly odds: number;
}

export const LANDING_WC_FAVORITES: readonly LandingWcFavorite[] = [
	{ code: 'BR', team: 'Brazil', flag: '🇧🇷', color: '#0F8C3A', odds: 17.9 },
	{ code: 'ES', team: 'Spain', flag: '🇪🇸', color: '#AA151B', odds: 14.8 },
	{ code: 'FR', team: 'France', flag: '🇫🇷', color: '#0033A0', odds: 13.6 },
	{ code: 'AR', team: 'Argentina', flag: '🇦🇷', color: '#75AADB', odds: 12.4 }
] as const;

/**
 * Category → label map used by the ticker + cards. Only the
 * categories that appear in `LANDING_MARKETS` are listed.
 */
export const LANDING_CAT_LABELS: Record<LandingMarketCategory, string> = {
	wc: 'World Cup',
	macro: 'Macro',
	crypto: 'Crypto',
	politics: 'Politics',
	tech: 'Tech',
	sports: 'Sports',
	culture: 'Culture'
};

/**
 * Category → accent color used by the FlowCard header tint.
 */
export const LANDING_CAT_COLORS: Record<LandingMarketCategory, string> = {
	wc: '#E2B842',
	macro: '#7EB6FF',
	crypto: '#FFB04A',
	politics: '#FF8A4C',
	tech: '#6FE0B6',
	sports: '#FF8A7A',
	culture: '#B49CFF'
};

/**
 * League rows used by the LeagueShowcase panel — `office-hex` members.
 */
export interface LandingLeagueMember {
	readonly rank: number;
	readonly handle: string;
	readonly shirt: string;
	readonly acc: number;
	readonly kls: 'gold' | 'silver' | 'bronze' | 'you' | 'normal';
}

export interface LandingLeague {
	readonly id: string;
	readonly name: string;
	readonly emblem: string;
	readonly color: string;
	readonly memberCount: number;
	readonly members: readonly LandingLeagueMember[];
}

export const LANDING_LEAGUES: readonly LandingLeague[] = [
	{
		id: 'office-hex',
		name: 'Office Hex',
		emblem: 'O',
		color: '#E2B842',
		memberCount: 12,
		members: [
			{ rank: 1, handle: 'augustus', shirt: '#E2B842', acc: 0.802, kls: 'gold' },
			{ rank: 2, handle: 'cassandra', shirt: '#75AADB', acc: 0.778, kls: 'silver' },
			{ rank: 3, handle: 'horatius', shirt: '#0033A0', acc: 0.764, kls: 'bronze' },
			{ rank: 4, handle: 'plinius', shirt: '#75AADB', acc: 0.751, kls: 'normal' },
			{ rank: 5, handle: 'livia', shirt: '#1F2A3A', acc: 0.742, kls: 'normal' },
			{ rank: 7, handle: 'YOU', shirt: '#E2B842', acc: 0.728, kls: 'you' }
		]
	},
	{
		id: 'lupercal',
		name: 'Lupercal Society',
		emblem: 'L',
		color: '#B5462C',
		memberCount: 8,
		members: [
			{ rank: 1, handle: 'marcus.x', shirt: '#2D2D2D', acc: 0.789, kls: 'gold' },
			{ rank: 2, handle: 'nero', shirt: '#75AADB', acc: 0.762, kls: 'silver' },
			{ rank: 3, handle: 'galba', shirt: '#0F8C3A', acc: 0.745, kls: 'bronze' }
		]
	}
];

/**
 * Worlds Universities — top 3 by `accWC` for the podium mini-panel.
 */
export interface LandingUniversity {
	readonly id: string;
	readonly name: string;
	readonly short: string;
	readonly color: string;
	readonly text: string;
	readonly accWC: number;
}

export const LANDING_WORLDS_UNIVERSITIES: readonly LandingUniversity[] = [
	{
		id: 'stanford',
		name: 'Stanford',
		short: 'STAN',
		color: '#8C1515',
		text: '#F2ECDC',
		accWC: 0.714
	},
	{
		id: 'harvard',
		name: 'Harvard',
		short: 'HARV',
		color: '#A51C30',
		text: '#F2ECDC',
		accWC: 0.682
	},
	{
		id: 'berkeley',
		name: 'Berkeley',
		short: 'BERK',
		color: '#003262',
		text: '#FDB515',
		accWC: 0.668
	},
	{ id: 'mit', name: 'MIT', short: 'MIT', color: '#A31F34', text: '#F2ECDC', accWC: 0.661 }
] as const;

export const LANDING_WORLDS_UNIVERSITIES_COUNT = 64;
