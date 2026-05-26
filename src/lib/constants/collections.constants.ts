import collections from '$root/juno.collections.json';

export const Collection = {
	ROLES: collections.ROLES,
	PROFILES: collections.PROFILES,
	RELATIONS: collections.RELATIONS,
	CHATS: collections.CHATS,
	COMMENTS: collections.COMMENTS,
	MARKET_METADATA: collections.MARKET_METADATA,
	MARKET_TRANSLATIONS: collections.MARKET_TRANSLATIONS,
	ACTIVITIES: collections.ACTIVITIES,
	/**
	 * Server-driven VXP new-user ladder state (owed vs paid); written from satellite hooks.
	 */
	VXP_ONBOARDING: collections.VXP_ONBOARDING,
	/**
	 * Per-user, per-award ledger of every VXP gameplay award the server fires — streak
	 * milestones, comeback grant, referral payouts, Worlds podium. The doc key encodes
	 * `{recipient}/{awardType}/{awardKey}` so a second write at the same milestone collides
	 * with the first (natural idempotency). Status transitions `pending → paid | failed`
	 * are enforced by the satellite assert.
	 */
	VXP_AWARDS: collections.VXP_AWARDS,
	/**
	 * Reverse index from referral code (key) to owning principal. One row per user; written by the
	 * satellite profile hook on first profile create.
	 */
	REFERRAL_CODES: collections.REFERRAL_CODES,
	/**
	 * Per-referee redemption record (key = referee principal). Tracks the referrer, the code, and
	 * the payout state for both sides. Written by `redeemReferralCode`; payout state is updated by
	 * the satellite referral hook.
	 */
	REFERRALS: collections.REFERRALS,
	/**
	 * Social cohorts — the prototype's user-created leagues. One doc per league, keyed by league id. Holds
	 * name, 6-char alphanumeric invite code (for the join-by-code flow), owner principal, and
	 * marketing metadata. Members and bouts live in follow-up collections so a league's metadata
	 * stays cheap to read without joining the membership table.
	 */
	LEAGUES: collections.LEAGUES,
	/**
	 * Per-member membership row, keyed by `${leagueId}/${memberPrincipal}`. Holds the member's
	 * role inside the league (owner / admin / member) and the joinedAt timestamp. Self-joins
	 * write directly; owner / admin can write rows for other principals (e.g. promote a member
	 * to admin). Drift between key and embedded fields is rejected by the satellite assert.
	 */
	LEAGUE_MEMBERS: collections.LEAGUE_MEMBERS,
	/**
	 * Bouts — the prototype's time-bound competitions. Two kinds: 'league' (leagueA vs leagueB) and
	 * 'duel' (proposer principal vs challenger principal). Doc key is the bout id. State machine
	 * `proposed → accepted → in_flight → resolved` enforced by the satellite assert; scores write
	 * once at settle, winner derived from scores.
	 */
	BOUTS: collections.BOUTS,
	/**
	 * Worlds affiliations — a user's chosen university and / or country, used for the prototype Worlds
	 * leaderboard surface (distinct from user-created leagues so the 90-day lock doesn't leak).
	 * Keyed `${member}/${kind}/${affiliationId}` so a user can carry one university + one country
	 * simultaneously. Server computes `lockedUntilMs = joinedAtMs + 90d` on first write; the delete
	 * assert hard-rejects until the lock expires.
	 */
	AFFILIATIONS: collections.AFFILIATIONS,
	/**
	 * Per-affiliation rolling stats for the Worlds leaderboard. One doc per `(kind, affiliationId)`
	 * keyed `${kind}/${affiliationId}`. Written exclusively by the satellite hook on
	 * `profiles` updates — when a user's `totalTrades` increments, the hook fans out the win/loss
	 * delta to that user's affiliation rows. The doc tracks both lifetime totals and the current
	 * month's totals (rolled over lazily on the first hook fire of a new calendar month).
	 */
	AFFILIATION_STATS: collections.AFFILIATION_STATS,
	/**
	 * Append-only churn-feedback log. Each doc records the `reason` + optional free-text `note`
	 * the user picked from the delete-account flow. Intentionally anonymous — no principal field,
	 * random UUID key — so the log survives the account it describes. Written exactly once by
	 * `deleteMyAccount` before the cascade hard-deletes the caller's identity.
	 */
	EXIT_SIGNALS: collections.EXIT_SIGNALS,
	/**
	 * Monthly single-elimination tournament metadata. One doc per month, keyed by month anchor
	 * (`YYYY-MM`). Holds the seeded league ids (top-16 by member count), bracket size, lifecycle
	 * state. Written by `triggerTournamentDraw` (idempotent — doc key collision rejects a second
	 * draw for the same month).
	 */
	TOURNAMENTS: collections.TOURNAMENTS,
	/**
	 * Per-match docs of every tournament. Keyed `${tournamentId}/${round}/${index}` so the
	 * bracket reads as a single prefix scan. Holds the two competing league ids, per-league
	 * accuracy (filled in by the round-resolution job), and the winning league. Written by
	 * `triggerTournamentDraw` (round 1 matches) and `resolveTournamentRound`.
	 */
	TOURNAMENT_MATCHES: collections.TOURNAMENT_MATCHES,
	/**
	 * Per-league rolling stats — lifetime resolved-call count + wins. One doc per league
	 * keyed by `leagueId`. Written exclusively by the satellite hook on `profiles` updates:
	 * when a user's `totalTrades` increments, the hook scans their league memberships and
	 * fans the delta out. Used by the tournament round-resolution flow to compute per-window
	 * accuracy as the delta between the round's start-of-window snapshot (frozen on the
	 * match doc) and the current rolling counter.
	 */
	LEAGUE_STATS: collections.LEAGUE_STATS
} as const;

export type Collection = (typeof Collection)[keyof typeof Collection];
