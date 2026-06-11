import type { AppLocale } from '$lib/constants/locale.constants';
import { MARKET_TAG_LABEL_KEYS, type MarketTag } from '$lib/constants/market-tags.constants';
import { t } from '$lib/utils/i18n.utils';

/**
 * Frontend-only rendering helpers for market tags.
 *
 * Kept apart from `market-tags.constants.ts` on purpose: that module is
 * bundled into the satellite wasm (via `normalizeMarketTags`), and `t`
 * is a runtime value whose module statically imports every locale
 * catalog — a value import of it from the constants module would ship
 * all catalogs inside the satellite and make every copy-only release
 * count as a satellite change for the deploy pipeline's upgrade check.
 */

/**
 * Variant of a category tag rendering:
 *
 * - `short` → the bare uppercased category id (`wc` → `WC`,
 *   `macro` → `MACRO`). Used on compact preview chips (market-list
 *   cards / rows) where space is tight and the accent colour carries
 *   most of the meaning.
 * - `full` → the localized category label via {@link MARKET_TAG_LABEL_KEYS}
 *   (`wc` → "World Cup", `macro` → "Macro"). Used on detail / full
 *   surfaces (FlowCard back, market-detail header). Any uppercasing
 *   there is left to CSS so the localized casing is preserved where the
 *   design doesn't shout.
 */
export type CategoryLabelVariant = 'short' | 'full';

/**
 * Single source of truth for rendering a market category tag. Reuses
 * {@link MARKET_TAG_LABEL_KEYS} for the `full` form so the label map is
 * never duplicated across surfaces.
 *
 * `locale` is only consulted for the `full` variant (the `short` form
 * is locale-independent), but it's required so call sites pass the
 * active `$localeStore` uniformly regardless of variant.
 */
export const categoryLabel = ({
	category,
	variant,
	locale
}: {
	category: MarketTag;
	variant: CategoryLabelVariant;
	locale: AppLocale;
}): string =>
	variant === 'short'
		? category.toUpperCase()
		: t({ locale, key: MARKET_TAG_LABEL_KEYS[category] });
