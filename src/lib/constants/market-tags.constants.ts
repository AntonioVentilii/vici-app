import type { MessageKey } from '$lib/utils/i18n.utils';

/**
 * Closed taxonomy of market tags. Tags are stored on `MarketMetadata` as
 * a `string[]` (0..N per market) and are the **only** source of truth
 * the frontend uses to categorise / filter markets — the dynamic
 * `categories` / `series_categories` collections have been removed.
 *
 * To add a tag: extend `MARKET_TAGS`, add a matching brand color in
 * `$lib/utils/tag-color.utils.ts`, and add `market.tag.<id>` to every
 * locale catalog under `src/lib/constants/messages/`.
 *
 * This module is bundled into the satellite wasm (the satellite imports
 * `normalizeMarketTags`), so it must stay free of VALUE imports of
 * frontend-only modules — in particular `$lib/utils/i18n.utils`, whose
 * runtime exports drag every locale catalog along (type-only imports
 * like `MessageKey` are fine: they're erased at compile time). Rendering
 * helpers belong in `$lib/utils/market-tags.utils.ts`.
 */
export const MARKET_TAGS = [
	'wc',
	'macro',
	'crypto',
	'politics',
	'tech',
	'sports',
	'culture'
] as const;

export type MarketTag = (typeof MARKET_TAGS)[number];

export const MARKET_TAG_LABEL_KEYS: Record<MarketTag, MessageKey> = {
	wc: 'market.tag.wc',
	macro: 'market.tag.macro',
	crypto: 'market.tag.crypto',
	politics: 'market.tag.politics',
	tech: 'market.tag.tech',
	sports: 'market.tag.sports',
	culture: 'market.tag.culture'
};

export const isMarketTag = (value: string): value is MarketTag =>
	(MARKET_TAGS as readonly string[]).includes(value);

/**
 * De-duplicates and filters out unknown values so persisted tags always
 * belong to the hardcoded taxonomy. Order follows {@link MARKET_TAGS}
 * (not insertion order) to keep equality checks stable across writes.
 */
export const normalizeMarketTags = (tags: readonly string[]): MarketTag[] => {
	const set = new Set<MarketTag>();

	for (const value of tags) {
		if (isMarketTag(value)) {
			set.add(value);
		}
	}

	return MARKET_TAGS.filter((tag) => set.has(tag));
};

/**
 * Resolves the "primary" tag of a market for surfaces that previously
 * displayed a single category (FlowCard artwork, PositionArtThumb,
 * MarketDetailHeader chip, …). Returns the first tag in canonical
 * {@link MARKET_TAGS} order — so the choice is stable and deterministic
 * regardless of the order the admin checked them.
 *
 * Returns `undefined` when the market has no tags; callers usually fall
 * back to a hash-of-id derived bucket (see `resolveFlowArtCategory`).
 */
export const primaryMarketTag = (tags: readonly MarketTag[] | undefined): MarketTag | undefined => {
	if (!tags || tags.length === 0) {
		return;
	}

	return MARKET_TAGS.find((tag) => tags.includes(tag));
};
