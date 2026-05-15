export interface AchievementDef {
	id: string;
	name: string;
	description: string;
	xp: number;
	icon: 'target' | 'flame' | 'eye' | 'zap' | 'timer' | 'star';
}

export const ACHIEVEMENTS: AchievementDef[] = [
	{
		id: 'first-blood',
		name: 'First call',
		description: 'Make your first prediction',
		xp: 50,
		icon: 'target'
	},
	{
		id: 'on-fire',
		name: 'On fire',
		description: '10 correct in a row',
		xp: 200,
		icon: 'flame'
	},
	{
		id: 'oracle',
		name: 'Oracle',
		description: '80% accuracy over 50 calls',
		xp: 500,
		icon: 'eye'
	},
	{
		id: 'contrarian',
		name: 'Contrarian',
		description: '10 wins on <30% consensus',
		xp: 400,
		icon: 'zap'
	},
	{
		id: 'marathon',
		name: 'Marathon',
		description: '30-day streak',
		xp: 800,
		icon: 'timer'
	},
	{
		id: 'lvl-25',
		name: 'Level 25',
		description: 'Reach level 25',
		xp: 1000,
		icon: 'star'
	}
];

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
