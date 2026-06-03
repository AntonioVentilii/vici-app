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
	 * Single-glyph emblem the owner picked from {@link LEAGUE_EMBLEMS}
	 * at creation. Rendered inside the gradient logo tile everywhere the
	 * league surfaces. Chosen once at creation and frozen alongside the
	 * identity fields. Absent on legacy rows written before the picker
	 * shipped — callers fall back to {@link leagueEmblem}.
	 */
	emblem?: string;
	/**
	 * Whether the league is private. Private leagues are only reachable
	 * by invite code and read as "Private" on the detail header; absent
	 * (or `false`) means a public league. Chosen once at creation.
	 */
	private?: boolean;
	/**
	 * Optional URL reference to an owner-uploaded cover image, stored in
	 * Juno Storage (the {@link LEAGUE_IMAGES_COLLECTION} collection). When
	 * set, every league surface renders this image (cover-fit) in place of
	 * the {@link leagueEmblem} glyph; clearing it falls back to the emblem.
	 * Only the URL reference lives on the doc — the bytes live in Storage,
	 * never a base64 data URL. Unlike the emblem, the owner can set, change,
	 * or clear this after creation.
	 */
	imageUrl?: string;
}

/**
 * Juno Storage collection that holds owner-uploaded league cover images.
 * The bytes live here; the doc only carries the resolved download URL on
 * {@link LeagueDoc.imageUrl}. Kept in sync with `juno.config.ts` and the
 * `Collection` enum in `collections.constants.ts`.
 */
export const LEAGUE_IMAGES_COLLECTION = 'league_images';

/**
 * Edge length (px) of the square league cover we downscale to before
 * upload, and the JPEG quality. A 256² cover JPEG is sharp on the logo
 * tile across every surface while keeping the stored asset tiny.
 */
export const LEAGUE_IMAGE_SIZE_PX = 256;
export const LEAGUE_IMAGE_JPEG_QUALITY = 0.82;

/**
 * Emblem glyphs the owner picks from in the create sheet. Stored
 * verbatim on the league doc's `emblem` field, then rendered inside
 * the gradient logo tile. The first entry is the default selection.
 */
export const LEAGUE_EMBLEMS = ['⚔', '☼', '✦', '✧', '◎', '⌬', '⊿', '☆'] as const;

/** Default emblem when the owner doesn't change the selection. */
export const [LEAGUE_EMBLEM_DEFAULT] = LEAGUE_EMBLEMS;

/**
 * Resolve the glyph to render for a league. Prefers the stored
 * `emblem`; for legacy rows written before the picker shipped, derives
 * a single-glyph mark from the first code-point of the name when it is
 * a letter (uppercased, Unicode-safe so emoji aren't split), falling
 * back to {@link LEAGUE_EMBLEM_DEFAULT} for empty, non-alphabetic, or
 * emoji-leading names.
 */
export const leagueEmblem = (league: Pick<LeagueDoc, 'emblem' | 'name'>): string => {
	if (league.emblem !== undefined && league.emblem.length > 0) {
		return league.emblem;
	}

	const [first] = Array.from(league.name.trim());

	return first !== undefined && /\p{Letter}/u.test(first)
		? first.toUpperCase()
		: LEAGUE_EMBLEM_DEFAULT;
};

/**
 * Invite-code shape. Six uppercase alphanumeric characters — the join
 * flow expects exactly this pattern, so the assert enforces it on every
 * write.
 */
export const LEAGUE_INVITE_CODE_REGEX = /^[A-Z0-9]{6}$/;

/**
 * Sample invite code shown as a format affordance — the join sheet's
 * helper line and the field placeholder both render this so the
 * expected shape (6 uppercase alphanumerics) reads at a glance. Kept as
 * a single constant so the two spots can never drift apart, and shaped
 * to satisfy {@link LEAGUE_INVITE_CODE_REGEX}.
 */
export const LEAGUE_INVITE_CODE_EXAMPLE = 'ABC123';

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
