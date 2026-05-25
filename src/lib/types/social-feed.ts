/**
 * V1.2 social feed — append-only event log for cohort activity.
 *
 * Each entry records a single domain event the user cares about:
 *
 *   - `league_joined`   — someone joined a league we're in
 *   - `bout_proposed`   — a league we're in received a bout proposal
 *   - `bout_accepted`   — a bout we proposed was accepted
 *   - `bout_resolved`   — a bout we participated in ended (winner derived)
 *   - `affiliation_set` — someone in our network claimed a Worlds slot
 *
 * Doc key shape: `${createdAtMs}/${actor}/${kind}/${refId}` — the
 * ms-prefix gives the feed a natural reverse-alphabetical sort for
 * newest-first scans.
 *
 * Entries are immutable after write (no edit, no delete). The feed
 * is a log, not a state machine.
 */

export type SocialFeedEntryKind =
	| 'league_joined'
	| 'bout_proposed'
	| 'bout_accepted'
	| 'bout_resolved'
	| 'affiliation_set';

export interface SocialFeedEntryDoc {
	/** Actor principal text — the user who triggered the event. */
	actor: string;
	/** Event kind. */
	kind: SocialFeedEntryKind;
	/** Reference to the affected resource — league id, bout id, or
	 *  `${kind}/${affiliationId}` for affiliation events. */
	refId: string;
	/** Optional context — e.g. winner side for bout_resolved,
	 *  affiliation name for affiliation_set. Free-form so the FE can
	 *  render without a second BE round-trip. */
	context?: string;
	/** Creation timestamp (ms since epoch). Matches the key prefix. */
	createdAtMs: number;
}

export const SOCIAL_FEED_ENTRY_KINDS: ReadonlySet<SocialFeedEntryKind> =
	new Set<SocialFeedEntryKind>([
		'league_joined',
		'bout_proposed',
		'bout_accepted',
		'bout_resolved',
		'affiliation_set'
	]);

/**
 * Canonical key builder. Uses 13-digit ms timestamp (left-padded if
 * needed) so the lexical sort is also chronological — a 12-digit
 * value would sort before a 13-digit one despite being older.
 */
export const socialFeedKey = ({
	createdAtMs,
	actor,
	kind,
	refId
}: {
	createdAtMs: number;
	actor: string;
	kind: SocialFeedEntryKind;
	refId: string;
}): string => {
	const paddedMs = createdAtMs.toString().padStart(13, '0');

	return `${paddedMs}/${actor}/${kind}/${refId}`;
};

/**
 * Soft cap on `context` length — keeps feed entries cheap to read
 * since we list many at once. The assert enforces this.
 */
export const SOCIAL_FEED_CONTEXT_MAX_LENGTH = 240;
