import type { MessageKey } from '$lib/utils/i18n.utils';

export type AchievementTier = 'gold' | 'silver' | 'bronze';

/**
 * Achievement definition — drives the Album tile + the unlock toast.
 *
 * `emblem` is a single unicode glyph rendered in the centre of the
 * tile. Matches the design source's AlbumScreen exactly
 * (`screens.jsx:4650`): each award has its own emblem
 * (`◎ ★ ⚡ ⌬ ⊿ ✦ ◐ ⧖ ⌘`). `tier` decides the wash colour
 * (gold = laurel-tinted, silver / bronze for monthly-leaderboard
 * achievements once they ship).
 *
 * `detailKey` is the rich multi-sentence prose surfaced in the
 * bottom-sheet modal — distinct from the short `descriptionKey`
 * sub-line on the tile.
 */
export interface AchievementDef {
	id: string;
	nameKey: MessageKey;
	descriptionKey: MessageKey;
	detailKey: MessageKey;
	emblem: string;
	tier: AchievementTier;
	xp: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
	{
		id: 'first-blood',
		nameKey: 'achievement.first_blood.name',
		descriptionKey: 'achievement.first_blood.description',
		detailKey: 'achievement.first_blood.detail',
		emblem: '◎',
		tier: 'gold',
		xp: 50
	},
	{
		id: 'on-fire',
		nameKey: 'achievement.on_fire.name',
		descriptionKey: 'achievement.on_fire.description',
		detailKey: 'achievement.on_fire.detail',
		emblem: '⚡',
		tier: 'gold',
		xp: 200
	},
	{
		id: 'oracle',
		nameKey: 'achievement.oracle.name',
		descriptionKey: 'achievement.oracle.description',
		detailKey: 'achievement.oracle.detail',
		emblem: '★',
		tier: 'gold',
		xp: 500
	},
	{
		id: 'contrarian',
		nameKey: 'achievement.contrarian.name',
		descriptionKey: 'achievement.contrarian.description',
		detailKey: 'achievement.contrarian.detail',
		emblem: '⧖',
		tier: 'gold',
		xp: 400
	},
	{
		id: 'marathon',
		nameKey: 'achievement.marathon.name',
		descriptionKey: 'achievement.marathon.description',
		detailKey: 'achievement.marathon.detail',
		emblem: '◐',
		tier: 'gold',
		xp: 800
	},
	{
		id: 'lvl-25',
		nameKey: 'achievement.lvl_25.name',
		descriptionKey: 'achievement.lvl_25.description',
		detailKey: 'achievement.lvl_25.detail',
		emblem: '⌘',
		tier: 'gold',
		xp: 1000
	}
];

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
