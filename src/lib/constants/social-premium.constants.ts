import type { AppLocale } from '$lib/constants/locale.constants';
import { type MessageKey, t } from '$lib/utils/i18n.utils';

/**
 * Curated list of "Fun Dare" premiums (what the loser owes the winner). The
 * creator picks one of these presets when creating a Social-domain market,
 * keeping the social reward consistent across the feed instead of every market
 * inventing its own copy. An `OTHER` sentinel lets the creator type a custom
 * premium when none of the presets fit.
 *
 * Each preset is rendered as `1 {label} {emoji}` (e.g. `1 Spritz 🥂`) and uses
 * `descKey` as the supporting description (e.g. `aperitivo`). Labels and
 * descriptions are localized in `src/lib/constants/messages/*` — values
 * displayed and stored at market-creation time follow the creator's locale.
 */

export const SOCIAL_PREMIUM_OTHER_ID = 'other' as const;

export type SocialPremiumPresetId = 'coffee' | 'beer' | 'pizza' | 'aperitif' | 'dinner';

export type SocialPremiumOptionId = SocialPremiumPresetId | typeof SOCIAL_PREMIUM_OTHER_ID;

export interface SocialPremiumPreset {
	readonly id: SocialPremiumPresetId;
	readonly emoji: string;
	readonly labelKey: MessageKey;
	readonly descKey: MessageKey;
}

export const SOCIAL_PREMIUM_PRESETS: readonly SocialPremiumPreset[] = [
	{
		id: 'coffee',
		emoji: '☕',
		labelKey: 'social.premium.coffee.label',
		descKey: 'social.premium.coffee.desc'
	},
	{
		id: 'beer',
		emoji: '🍺',
		labelKey: 'social.premium.beer.label',
		descKey: 'social.premium.beer.desc'
	},
	{
		id: 'pizza',
		emoji: '🍕',
		labelKey: 'social.premium.pizza.label',
		descKey: 'social.premium.pizza.desc'
	},
	{
		id: 'aperitif',
		emoji: '🥂',
		labelKey: 'social.premium.aperitif.label',
		descKey: 'social.premium.aperitif.desc'
	},
	{
		id: 'dinner',
		emoji: '🍝',
		labelKey: 'social.premium.dinner.label',
		descKey: 'social.premium.dinner.desc'
	}
] as const;

export const DEFAULT_SOCIAL_PREMIUM_ID: SocialPremiumPresetId = 'coffee';

const findPreset = (id: SocialPremiumOptionId): SocialPremiumPreset | undefined =>
	SOCIAL_PREMIUM_PRESETS.find((preset) => preset.id === id);

/**
 * Render the picked premium into the `{ title, description }` shape consumed
 * by `createMarket`'s `socialReward` argument. Returns `undefined` when the
 * "Other" option is selected without any custom text — callers should treat
 * that as a validation error.
 */
export const formatSocialPremium = ({
	optionId,
	customTitle,
	locale
}: {
	optionId: SocialPremiumOptionId;
	customTitle: string;
	locale: AppLocale;
}): { title: string; description: string } | undefined => {
	if (optionId === SOCIAL_PREMIUM_OTHER_ID) {
		const trimmed = customTitle.trim();

		if (trimmed.length === 0) {
			return;
		}

		return {
			title: trimmed,
			description: t({ locale, key: 'social.premium.other.desc' })
		};
	}

	const preset = findPreset(optionId);

	if (preset === undefined) {
		return;
	}

	const label = t({ locale, key: preset.labelKey });
	const description = t({ locale, key: preset.descKey });

	return {
		title: `1 ${label} ${preset.emoji}`,
		description
	};
};
