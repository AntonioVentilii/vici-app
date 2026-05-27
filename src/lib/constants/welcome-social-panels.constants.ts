/**
 * Mock data for the landing-page Social Proof trio
 * (LeagueShowcase / BoutShowcase / WorldsUniversitiesBout).
 *
 * Faithfully mirrors the prototype values in
 * `VICI WebApp Beta V1.2/landing.jsx` (Panel 01/02/03). These are
 * landing visuals only — not wired to real data. Keep the shapes
 * minimal so the three Svelte panels render without pulling in the
 * full app's data layer.
 */

export interface WelcomeLeagueMember {
	readonly rank: number;
	readonly handle: string;
	/** Inline tone for the avatar disc — small colour swatch behind the initial. */
	readonly shirt: string;
	/** Accuracy as 0..1; renders as e.g. `74.2%` via the percent formatter. */
	readonly accuracy: number;
	/** `you` highlights the row; `gold` colours the accuracy in laurel; null = default. */
	readonly kind: 'you' | 'gold' | null;
}

export interface WelcomeLeagueMock {
	readonly name: string;
	readonly emblem: string;
	readonly color: string;
	readonly memberCount: number;
	readonly members: readonly WelcomeLeagueMember[];
}

export interface WelcomeBoutLeague {
	readonly name: string;
	readonly emblem: string;
	readonly color: string;
	readonly memberCount: number;
	readonly accuracy: number;
}

export interface WelcomeBoutMock {
	readonly left: WelcomeBoutLeague;
	readonly right: WelcomeBoutLeague;
	readonly day: number;
	readonly totalDays: number;
}

export interface WelcomeUniversityMock {
	readonly id: string;
	readonly name: string;
	readonly short: string;
	readonly color: string;
	readonly text: string;
	readonly accuracy: number;
}

export const WELCOME_LEAGUE_SHOWCASE: WelcomeLeagueMock = {
	name: 'Office Hex',
	emblem: 'OH',
	color: '#E2B842',
	memberCount: 12,
	members: [
		{ rank: 1, handle: 'augustus', shirt: '#E2B842', accuracy: 0.821, kind: 'gold' },
		{ rank: 2, handle: 'cassandra', shirt: '#7BB662', accuracy: 0.792, kind: null },
		{ rank: 3, handle: 'marcus', shirt: '#B49CFF', accuracy: 0.764, kind: null },
		{ rank: 7, handle: 'you', shirt: '#B5462C', accuracy: 0.681, kind: 'you' }
	]
};

export const WELCOME_BOUT_SHOWCASE: WelcomeBoutMock = {
	left: {
		name: 'Office Hex',
		emblem: 'OH',
		color: '#E2B842',
		memberCount: 12,
		accuracy: 0.742
	},
	right: {
		name: 'Lupercal',
		emblem: 'LU',
		color: '#B5462C',
		memberCount: 14,
		accuracy: 0.718
	},
	day: 4,
	totalDays: 7
};

/**
 * Three-school podium for the Worlds Universities feature panel. Order in
 * the array is decreasing accuracy — the panel rearranges them to
 * silver / gold / bronze (gold centred + taller) at render time.
 */
export const WELCOME_UNIVERSITIES_PODIUM: readonly WelcomeUniversityMock[] = [
	{ id: 'oxf', name: 'Oxford', short: 'OXF', color: '#002147', text: '#F2ECDC', accuracy: 0.788 },
	{
		id: 'stan',
		name: 'Stanford',
		short: 'STAN',
		color: '#8C1515',
		text: '#F2ECDC',
		accuracy: 0.762
	},
	{
		id: 'harv',
		name: 'Harvard',
		short: 'HARV',
		color: '#A41034',
		text: '#F2ECDC',
		accuracy: 0.741
	}
] as const;

export const WELCOME_UNIVERSITIES_TOTAL = 32;
