/**
 * League privacy — the three-way visibility model an owner picks at
 * creation and can change later (see `updateLeague`). Replaces the legacy
 * `private?: boolean` flag on the league doc (see {@link LeagueDoc}).
 *
 * Privacy controls **discoverability only**, never the join gate: the
 * invite code is the sole way into a league at every tier. What changes
 * across tiers is where — and to whom — the league surfaces.
 *
 * Tiers are ordered most → least restrictive everywhere they surface:
 *
 * - {@link LeaguePrivacy.PRIVATE} — hidden: reachable only by invite code,
 *   never surfaced in any public list or recommendation.
 * - {@link LeaguePrivacy.INVITE} — NOT publicly listed, but recommendable
 *   to a member's friends. Reachable by invite code.
 * - {@link LeaguePrivacy.OPEN} — publicly listed: surfaced in
 *   recommendations / challenge pools to anyone. Still joined by invite
 *   code, same as every tier.
 *
 * The string values match the create surface's option ids so the picker
 * value persists verbatim onto the doc.
 */
export enum LeaguePrivacy {
	PRIVATE = 'private',
	INVITE = 'invite',
	OPEN = 'open'
}
