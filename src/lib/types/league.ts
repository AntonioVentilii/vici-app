/**
 * Social cohorts — leagues.
 *
 * A league is a user-created cohort with a 6-char alphanumeric invite
 * code that the owner shares to bring members in. Members and battles
 * live in follow-up collections (`league_members`, `battles`) so the
 * league metadata stays cheap to list without joining membership.
 *
 * Doc key for `leagues` is the league id — a slug-style identifier
 * picked by the owner at creation. Drift between key and the embedded
 * `id` field is rejected by the assert.
 */
export interface LeagueDoc {
	/** Stable slug identifier — matches the doc key. */
	id: string;
	/** Display name (3–40 chars, free-form). */
	name: string;
	/** Optional short editorial blurb shown on the league detail page. */
	description?: string;
	/** 6-char `[A-Z0-9]` invite code; the join-by-code flow looks the league up by this. */
	inviteCode: string;
	/** Owning principal (text form). Immutable after creation. */
	owner: string;
	/** Creation timestamp in ms since epoch. Immutable. */
	createdAtMs: number;
	/** Optional accent colour (hex) for the league chip. */
	accentColor?: string;
	/**
	 * Whether the league is private. Private leagues are only reachable
	 * by invite code and read as "Private" on the detail header; absent
	 * (or `false`) means a public league. Chosen once at creation.
	 */
	private?: boolean;
}

/**
 * Invite-code shape. Six uppercase alphanumeric characters — the join
 * flow expects exactly this pattern, so the assert enforces it on every
 * write.
 */
export const LEAGUE_INVITE_CODE_REGEX = /^[A-Z0-9]{6}$/;

/**
 * Display-name length window — 3 chars keeps single-letter junk out,
 * 40 keeps the chip readable on a phone screen.
 */
export const LEAGUE_NAME_MIN_LENGTH = 3;
export const LEAGUE_NAME_MAX_LENGTH = 40;

/**
 * Description length cap — 240 chars covers a Twitter-style blurb
 * without bloating the league list payload.
 */
export const LEAGUE_DESCRIPTION_MAX_LENGTH = 240;
