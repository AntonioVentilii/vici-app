import type { MessageKey } from '$lib/utils/i18n.utils';

export type AchievementTier = 'gold' | 'silver' | 'bronze';

/**
 * Achievement definition — drives the Album tile + the unlock toast.
 *
 * On the profile + album surfaces the canonical render is the lucide
 * `Trophy` outline glyph with the tier-tinted wash (every award shows
 * the same trophy mark, matching the prototype's AlbumScreen).
 * `emblem` is kept as a single unicode fallback glyph for surfaces
 * that render the def out-of-band (Dash next-up rail) and for
 * screen-reader / plain-text contexts. The catalogue uses the brand's
 * approved glyph set (`◎ ★ ⚡ ⧖ ◐ ⌘` — see `docs/ai/frontend/brand.md`).
 *
 * `tier` decides the wash colour (gold = laurel-tinted; silver /
 * bronze are reserved for monthly-leaderboard achievements once they
 * ship).
 *
 * `detailKey` is the rich multi-sentence prose surfaced in the
 * bottom-sheet modal — distinct from the short `descriptionKey`
 * sub-line on the tile.
 *
 * The order in this array is the default render order for the
 * profile achievement rail before progress-sorting kicks in: it leads
 * with the prototype's first-render trio (`lvl-25`, `contrarian`,
 * `marathon`).
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
		id: 'lvl-25',
		nameKey: 'achievement.lvl_25.name',
		descriptionKey: 'achievement.lvl_25.description',
		detailKey: 'achievement.lvl_25.detail',
		emblem: '⌘',
		tier: 'gold',
		xp: 1000
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
	}
];

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
