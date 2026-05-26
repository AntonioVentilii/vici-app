import type { AffiliationKind } from '$lib/types/affiliation';

/**
 * Static rosters for the FE Worlds picker. The satellite keys
 * affiliations by `(kind, affiliationId)` without validating against
 * an external list, so the FE owns the curated set of choices.
 *
 * Future: an admin-curated registry collection can replace these
 * hardcoded arrays without touching the satellite assert (the assert
 * only enforces shape + lock, not the affiliation id's existence).
 */

export interface WorldsAffiliationOption {
	/** External id stored on `AffiliationDoc.affiliationId`. */
	id: string;
	/** Display name. */
	name: string;
	/** Decorative glyph — emoji flag for countries, short acronym for
	 *  universities. */
	glyph: string;
}

/**
 * University roster — kept small for launch. The list is curated
 * against the universities that surface in the Worlds leaderboard
 * mocks plus a few flagship additions.
 */
export const WORLDS_UNIVERSITIES: readonly WorldsAffiliationOption[] = [
	{ id: 'mit', name: 'MIT', glyph: 'MIT' },
	{ id: 'stanford', name: 'Stanford', glyph: 'STF' },
	{ id: 'harvard', name: 'Harvard', glyph: 'HRV' },
	{ id: 'cambridge', name: 'Cambridge', glyph: 'CAM' },
	{ id: 'oxford', name: 'Oxford', glyph: 'OXF' },
	{ id: 'eth-zurich', name: 'ETH Zurich', glyph: 'ETH' },
	{ id: 'imperial', name: 'Imperial', glyph: 'IMP' },
	{ id: 'lse', name: 'LSE', glyph: 'LSE' },
	{ id: 'sciences-po', name: 'Sciences Po', glyph: 'SCP' },
	{ id: 'tsinghua', name: 'Tsinghua', glyph: 'TSH' },
	{ id: 'nus', name: 'NUS', glyph: 'NUS' },
	{ id: 'utokyo', name: 'University of Tokyo', glyph: 'TKY' },
	{ id: 'iit-bombay', name: 'IIT Bombay', glyph: 'IIT' },
	{ id: 'sao-paulo', name: 'São Paulo', glyph: 'USP' },
	{ id: 'unam', name: 'UNAM', glyph: 'UNM' },
	{ id: 'bocconi', name: 'Bocconi', glyph: 'BOC' }
] as const;

/**
 * Country roster — ISO-3166 alpha-2 ids, emoji flags. Tracks the
 * top ~24 countries by predicted active-user volume; future expansion
 * is an additions-only change (no satellite migration needed).
 */
export const WORLDS_COUNTRIES: readonly WorldsAffiliationOption[] = [
	{ id: 'AR', name: 'Argentina', glyph: '🇦🇷' },
	{ id: 'AU', name: 'Australia', glyph: '🇦🇺' },
	{ id: 'BR', name: 'Brazil', glyph: '🇧🇷' },
	{ id: 'CA', name: 'Canada', glyph: '🇨🇦' },
	{ id: 'CH', name: 'Switzerland', glyph: '🇨🇭' },
	{ id: 'CN', name: 'China', glyph: '🇨🇳' },
	{ id: 'DE', name: 'Germany', glyph: '🇩🇪' },
	{ id: 'DK', name: 'Denmark', glyph: '🇩🇰' },
	{ id: 'ES', name: 'Spain', glyph: '🇪🇸' },
	{ id: 'FR', name: 'France', glyph: '🇫🇷' },
	{ id: 'GB', name: 'United Kingdom', glyph: '🇬🇧' },
	{ id: 'IN', name: 'India', glyph: '🇮🇳' },
	{ id: 'IT', name: 'Italy', glyph: '🇮🇹' },
	{ id: 'JP', name: 'Japan', glyph: '🇯🇵' },
	{ id: 'KR', name: 'Korea Rep.', glyph: '🇰🇷' },
	{ id: 'MX', name: 'Mexico', glyph: '🇲🇽' },
	{ id: 'NL', name: 'Netherlands', glyph: '🇳🇱' },
	{ id: 'PT', name: 'Portugal', glyph: '🇵🇹' },
	{ id: 'SE', name: 'Sweden', glyph: '🇸🇪' },
	{ id: 'SG', name: 'Singapore', glyph: '🇸🇬' },
	{ id: 'TR', name: 'Turkey', glyph: '🇹🇷' },
	{ id: 'US', name: 'United States', glyph: '🇺🇸' },
	{ id: 'ZA', name: 'South Africa', glyph: '🇿🇦' }
] as const;

/**
 * Indexed lookup for the FE — given a stored `affiliationId` + kind,
 * resolve to the display option. Returns `undefined` for ids no longer
 * in the static roster (e.g. an option was removed but a user still
 * carries the affiliation; the FE falls back to showing the id).
 */
export const lookupWorldsAffiliation = ({
	kind,
	id
}: {
	kind: AffiliationKind;
	id: string;
}): WorldsAffiliationOption | undefined => {
	const roster = kind === 'university' ? WORLDS_UNIVERSITIES : WORLDS_COUNTRIES;

	return roster.find((option) => option.id === id);
};
