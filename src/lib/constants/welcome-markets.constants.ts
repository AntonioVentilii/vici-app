/** Static preview markets for the public `/welcome` landing grid. */
export interface WelcomeMarketPreview {
	readonly id: string;
	readonly category: string;
	readonly question: string;
	readonly yesPercent: number;
	readonly closesLabel: string;
}

export const WELCOME_MARKET_PREVIEWS: readonly WelcomeMarketPreview[] = [
	{
		id: 'fed-jun',
		category: 'macro',
		question: 'Will the Fed cut rates in June?',
		yesPercent: 64,
		closesLabel: 'June 18'
	},
	{
		id: 'btc-150k',
		category: 'crypto',
		question: 'Will BTC close above $150K by year-end?',
		yesPercent: 38,
		closesLabel: 'Dec 31'
	},
	{
		id: 'gpt6-2026',
		category: 'tech',
		question: 'Will OpenAI release GPT-6 before Q4?',
		yesPercent: 22,
		closesLabel: 'Sep 30'
	},
	{
		id: 'sb-niners',
		category: 'sports',
		question: 'Will the 49ers win the Super Bowl?',
		yesPercent: 31,
		closesLabel: 'Feb 8'
	},
	{
		id: 'eu-ai-act',
		category: 'politics',
		question: 'Will the EU pass the AI Liability Act this session?',
		yesPercent: 55,
		closesLabel: 'Jul 12'
	},
	{
		id: 'eth-flip',
		category: 'crypto',
		question: 'Will ETH market cap exceed BTC by 2027?',
		yesPercent: 9,
		closesLabel: 'Jan 1, 2027'
	}
] as const;
