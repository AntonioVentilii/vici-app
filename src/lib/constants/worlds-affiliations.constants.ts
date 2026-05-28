import type { AffiliationKind } from '$lib/types/affiliation';

/**
 * Static rosters for the FE Worlds picker. The satellite keys
 * affiliations by `(kind, affiliationIdentifier)` without validating against
 * an external list, so the FE owns the curated set of choices.
 *
 * Future: an admin-curated registry collection can replace these
 * hardcoded arrays without touching the satellite assert (the assert
 * only enforces shape + lock, not the affiliation id's existence).
 */

export interface WorldsAffiliationOption {
	/** External id stored on `AffiliationDoc.affiliationIdentifier`. */
	id: string;
	/** Display name. */
	name: string;
	/** Decorative glyph — emoji flag for countries, short acronym for
	 *  universities. */
	glyph: string;
}

/**
 * University roster — covers the global flagship set plus regional
 * top tiers (US Ivies + UC + Big Ten, UK Russell Group, Europe
 * grandes écoles + ETH-tier, Asia top-tier, LATAM flagships).
 * Future additions are append-only (no satellite migration needed).
 */
export const WORLDS_UNIVERSITIES: readonly WorldsAffiliationOption[] = [
	// US · Tier 1
	{ id: 'mit', name: 'MIT', glyph: 'MIT' },
	{ id: 'stanford', name: 'Stanford', glyph: 'STF' },
	{ id: 'harvard', name: 'Harvard', glyph: 'HRV' },
	{ id: 'berkeley', name: 'Berkeley', glyph: 'BRK' },
	{ id: 'princeton', name: 'Princeton', glyph: 'PRN' },
	{ id: 'yale', name: 'Yale', glyph: 'YAL' },
	{ id: 'caltech', name: 'Caltech', glyph: 'CIT' },
	{ id: 'columbia', name: 'Columbia', glyph: 'CLM' },
	{ id: 'chicago', name: 'Chicago', glyph: 'UCH' },
	{ id: 'penn', name: 'Penn', glyph: 'UPN' },
	{ id: 'cornell', name: 'Cornell', glyph: 'COR' },
	{ id: 'ucla', name: 'UCLA', glyph: 'UCA' },
	{ id: 'nyu', name: 'NYU', glyph: 'NYU' },
	{ id: 'duke', name: 'Duke', glyph: 'DUK' },
	{ id: 'northwestern', name: 'Northwestern', glyph: 'NWU' },
	{ id: 'cmu', name: 'CMU', glyph: 'CMU' },
	{ id: 'umich', name: 'Michigan', glyph: 'MCH' },
	{ id: 'georgetown', name: 'Georgetown', glyph: 'GTN' },
	// UK · Russell Group
	{ id: 'cambridge', name: 'Cambridge', glyph: 'CAM' },
	{ id: 'oxford', name: 'Oxford', glyph: 'OXF' },
	{ id: 'imperial', name: 'Imperial', glyph: 'IMP' },
	{ id: 'lse', name: 'LSE', glyph: 'LSE' },
	{ id: 'ucl', name: 'UCL', glyph: 'UCL' },
	{ id: 'edinburgh', name: 'Edinburgh', glyph: 'EDI' },
	{ id: 'kings-college', name: 'King’s College', glyph: 'KCL' },
	{ id: 'manchester', name: 'Manchester', glyph: 'MAN' },
	{ id: 'warwick', name: 'Warwick', glyph: 'WAR' },
	{ id: 'bristol', name: 'Bristol', glyph: 'BRS' },
	// Continental Europe
	{ id: 'eth-zurich', name: 'ETH Zurich', glyph: 'ETH' },
	{ id: 'epfl', name: 'EPFL', glyph: 'EPF' },
	{ id: 'sciences-po', name: 'Sciences Po', glyph: 'SCP' },
	{ id: 'hec-paris', name: 'HEC Paris', glyph: 'HEC' },
	{ id: 'polytechnique', name: 'Polytechnique', glyph: 'X' },
	{ id: 'sorbonne', name: 'Sorbonne', glyph: 'SRB' },
	{ id: 'tum', name: 'TU Munich', glyph: 'TUM' },
	{ id: 'lmu-munich', name: 'LMU Munich', glyph: 'LMU' },
	{ id: 'humboldt', name: 'Humboldt Berlin', glyph: 'HUB' },
	{ id: 'heidelberg', name: 'Heidelberg', glyph: 'HEI' },
	{ id: 'bocconi', name: 'Bocconi', glyph: 'BOC' },
	{ id: 'la-sapienza', name: 'La Sapienza', glyph: 'SAP' },
	{ id: 'iese', name: 'IESE', glyph: 'IES' },
	{ id: 'esade', name: 'ESADE', glyph: 'ESD' },
	{ id: 'ie', name: 'IE Business School', glyph: 'IE' },
	{ id: 'ku-leuven', name: 'KU Leuven', glyph: 'KUL' },
	{ id: 'tu-delft', name: 'TU Delft', glyph: 'TUD' },
	{ id: 'uva', name: 'Amsterdam', glyph: 'UVA' },
	{ id: 'copenhagen', name: 'Copenhagen', glyph: 'KU' },
	{ id: 'stockholm', name: 'Stockholm', glyph: 'STK' },
	// Asia
	{ id: 'tsinghua', name: 'Tsinghua', glyph: 'TSH' },
	{ id: 'peking', name: 'Peking University', glyph: 'PKU' },
	{ id: 'fudan', name: 'Fudan', glyph: 'FDU' },
	{ id: 'hku', name: 'HKU', glyph: 'HKU' },
	{ id: 'hkust', name: 'HKUST', glyph: 'UST' },
	{ id: 'nus', name: 'NUS', glyph: 'NUS' },
	{ id: 'ntu-singapore', name: 'NTU Singapore', glyph: 'NTU' },
	{ id: 'utokyo', name: 'University of Tokyo', glyph: 'TKY' },
	{ id: 'kyoto', name: 'Kyoto', glyph: 'KYU' },
	{ id: 'snu', name: 'Seoul National', glyph: 'SNU' },
	{ id: 'kaist', name: 'KAIST', glyph: 'KST' },
	{ id: 'iit-bombay', name: 'IIT Bombay', glyph: 'IIT' },
	{ id: 'iit-delhi', name: 'IIT Delhi', glyph: 'IID' },
	{ id: 'iisc', name: 'IISc Bangalore', glyph: 'ISC' },
	// Canada + Oceania
	{ id: 'utoronto', name: 'Toronto', glyph: 'UFT' },
	{ id: 'mcgill', name: 'McGill', glyph: 'MCG' },
	{ id: 'ubc', name: 'UBC', glyph: 'UBC' },
	{ id: 'melbourne', name: 'Melbourne', glyph: 'MLB' },
	{ id: 'sydney', name: 'Sydney', glyph: 'SYD' },
	{ id: 'anu', name: 'ANU', glyph: 'ANU' },
	// LATAM + MEA
	{ id: 'sao-paulo', name: 'São Paulo', glyph: 'USP' },
	{ id: 'unam', name: 'UNAM', glyph: 'UNM' },
	{ id: 'itam', name: 'ITAM', glyph: 'ITM' },
	{ id: 'tec-monterrey', name: 'Tec de Monterrey', glyph: 'TEC' },
	{ id: 'uc-chile', name: 'UC Chile', glyph: 'UCC' },
	{ id: 'fgv', name: 'FGV', glyph: 'FGV' },
	{ id: 'tel-aviv', name: 'Tel Aviv', glyph: 'TAU' },
	{ id: 'technion', name: 'Technion', glyph: 'TCH' },
	{ id: 'kaust', name: 'KAUST', glyph: 'KAU' },
	{ id: 'cape-town', name: 'Cape Town', glyph: 'UCT' }
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
 * Indexed lookup for the FE — given a stored `affiliationIdentifier` + kind,
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
