/**
 * League privacy — the three-way visibility model an owner picks at
 * creation and can change later (see `updateLeague`). Replaces the legacy
 * `private?: boolean` flag on the league doc (see {@link LeagueDoc}).
 *
 * - {@link LeaguePrivacy.OPEN} — publicly listed and joinable: surfaced in
 *   recommendations / challenge pools to anyone.
 * - {@link LeaguePrivacy.INVITE} — joinable via invite code but NOT
 *   publicly listed. Still recommendable to a member's friends (the code
 *   is the gate, not secrecy).
 * - {@link LeaguePrivacy.PRIVATE} — hidden: reachable only by invite code,
 *   never surfaced in any public list or recommendation.
 *
 * The string values match the create surface's option ids so the picker
 * value persists verbatim onto the doc.
 */
export enum LeaguePrivacy {
	OPEN = 'open',
	INVITE = 'invite',
	PRIVATE = 'private'
}
