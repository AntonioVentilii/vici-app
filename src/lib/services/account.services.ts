import { functions } from '$declarations/satellite/satellite.api';
import type { ExitSignalReason } from '$lib/types/exit-signal';

/**
 * Account deletion — Proposal 4. FE wrappers around the
 * `listMyBlockingLeagues` query + `deleteMyAccount` update.
 *
 * The deletion flow is two phases on the satellite:
 *
 *  1. **Pre-flight.** `listMyBlockingLeagues` returns the league ids
 *     the caller owns that still have other members. The Settings
 *     page calls this when the user first opens the delete flow so
 *     the "transfer ownership first" prompt is surfaced *before*
 *     they pick a reason and type a note.
 *
 *  2. **Deletion.** `deleteMyAccount({ reason, note })` writes the
 *     anonymous exit-signal doc, then cascades hard-deletes for the
 *     caller's identity-keyed rows. On success the FE drops auth
 *     (`signOut`) so the user lands on the sign-in screen.
 *
 * Both calls go through the satellite's authenticated update / query
 * surface; the caller is the auth principal.
 */

export interface DeleteMyAccountResult {
	ok: boolean;
	reason?: 'owns_non_empty_league' | 'invalid_input';
	blockingLeagueIds?: string[];
	docsDeleted?: number;
}

/**
 * Pre-flight: list leagues the caller owns that still have other
 * members. Empty array means deletion is free to proceed.
 *
 * The FE calls this on every entry into the delete flow so the
 * guard surfaces in real time — a league that drained between
 * checks will unblock the user without a page reload.
 */
export const listMyBlockingLeagues = async (): Promise<string[]> => {
	const { leagueIds } = await functions.listMyBlockingLeagues();

	return leagueIds;
};

/**
 * Fire the account-deletion endpoint. On success the caller should
 * `signOut()` immediately — the satellite has already dropped the
 * profile + identity-keyed rows, so any subsequent read would
 * surface a half-deleted state to the UI.
 *
 * On `ok: false` with `reason: 'owns_non_empty_league'`, the
 * `blockingLeagueIds` field tells the UI which leagues to surface
 * in the transfer-first prompt.
 */
export const deleteMyAccount = ({
	reason,
	note
}: {
	reason: ExitSignalReason;
	note: string;
}): Promise<DeleteMyAccountResult> =>
	functions.deleteMyAccount({
		reason,
		note
	});
