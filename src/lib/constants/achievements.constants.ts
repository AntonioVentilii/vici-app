import type { MessageKey } from '$lib/utils/i18n.utils';

export interface AchievementDef {
	id: string;
	nameKey: MessageKey;
	descriptionKey: MessageKey;
	xp: number;
	icon: 'target' | 'flame' | 'eye' | 'zap' | 'timer' | 'star';
}

export const ACHIEVEMENTS: AchievementDef[] = [
	{
		id: 'first-blood',
		nameKey: 'achievement.first_blood.name',
		descriptionKey: 'achievement.first_blood.description',
		xp: 50,
		icon: 'target'
	},
	{
		id: 'on-fire',
		nameKey: 'achievement.on_fire.name',
		descriptionKey: 'achievement.on_fire.description',
		xp: 200,
		icon: 'flame'
	},
	{
		id: 'oracle',
		nameKey: 'achievement.oracle.name',
		descriptionKey: 'achievement.oracle.description',
		xp: 500,
		icon: 'eye'
	},
	{
		id: 'contrarian',
		nameKey: 'achievement.contrarian.name',
		descriptionKey: 'achievement.contrarian.description',
		xp: 400,
		icon: 'zap'
	},
	{
		id: 'marathon',
		nameKey: 'achievement.marathon.name',
		descriptionKey: 'achievement.marathon.description',
		xp: 800,
		icon: 'timer'
	},
	{
		id: 'lvl-25',
		nameKey: 'achievement.lvl_25.name',
		descriptionKey: 'achievement.lvl_25.description',
		xp: 1000,
		icon: 'star'
	}
];

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
