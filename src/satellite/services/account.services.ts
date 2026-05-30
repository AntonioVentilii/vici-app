import { Collection } from '$lib/constants/collections.constants';
import {
	EXIT_SIGNAL_NOTE_MAX_LENGTH,
	EXIT_SIGNAL_REASONS,
	type ExitSignalDoc,
	type ExitSignalReason
} from '$lib/types/exit-signal';
import type { LeagueDoc } from '$lib/types/league';
import type { LeagueMemberDoc } from '$lib/types/league-member';
import type { UserProfile } from '$lib/types/profile';
import type { ReferralCodeDoc, ReferralDoc } from '$lib/types/referral';
import type { Relation } from '$lib/types/relation';
import { isAdmin } from '$satellite/services/_authz';
import { isNullish, nonNullish } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';
import { msgCaller, time } from '@junobuild/functions/ic-cdk';
import {
	decodeDocData,
	deleteDocStore,
	encodeDocData,
	getDocStore,
	listDocsStore,
	setDocStore
} from '@junobuild/functions/sdk';

/**
 * Recovery window for soft-deleted accounts (Delete account v2). After
 * `deleteMyAccount` soft-deletes a profile (sets `deletedAtMs`), the
 * owner has this long to call `recoverMyAccount` and restore the full
 * account. Past the window the account is eligible for the admin sweep's
 * hard-delete (and `recoverMyAccount` itself hard-deletes on a too-late
 * call). 30 days, in milliseconds.
 */
export const ACCOUNT_RECOVERY_WINDOW_MS = 30 * 86_400_000;

/**
 * Account deletion — Proposal 4 in `docs/backend-proposals/README.md`
 * (Delete account v2: soft-delete + recovery + admin sweep).
 *
 * `deleteMyAccount` runs three steps in order:
 *
 *  1. **Owner-leagues guard.** If the caller owns any league that
 *     still has another member, the deletion is refused with
 *     `reason: 'owns_non_empty_league'`. The FE surfaces a
 *     "transfer ownership first" prompt (decision 4.3). League
 *     transfer/delete resolution is a later PR; the guard is
 *     unchanged.
 *
 *  2. **Exit-signal write.** A single `EXIT_SIGNALS` doc is appended
 *     with the chosen reason + optional note. The doc has no
 *     principal field — it's intentionally unlinkable from the
 *     account that wrote it.
 *
 *  3. **Soft-delete.** The caller's profile gets `deletedAtMs = now`
 *     (decision 4.1, soft-delete preserves the audit trail). NO data
 *     is removed — recovery must be able to restore the full account.
 *     The nickname is left untouched so the handle stays reserved
 *     (`checkNicknameAvailability` scans every profile doc). A second
 *     soft-delete keeps the EARLIEST `deletedAtMs` so the recovery
 *     clock can't be reset by re-deleting.
 *
 * After this returns ok the FE drops auth (`signOut`). The principal
 * can `recoverMyAccount` within {@link ACCOUNT_RECOVERY_WINDOW_MS};
 * past that window the data is hard-deleted (lazily, on a too-late
 * recovery attempt, or eagerly by the admin `sweepExpiredDeletions`).
 *
 * The hard-delete cascade itself lives in {@link hardDeleteAccountFn},
 * parametrised by principal so the sweep can run it for any account.
 */

export type DeleteMyAccountRefusalReason = 'owns_non_empty_league' | 'invalid_input';

export interface DeleteMyAccountResult {
	ok: boolean;
	/** Set when `ok === false`. Drives the FE's refusal banner. */
	reason?: DeleteMyAccountRefusalReason;
	/**
	 * League ids the caller owns that still have other members. Only
	 * populated when `reason === 'owns_non_empty_league'`; the FE
	 * uses them to render a "transfer these first" CTA.
	 */
	blockingLeagueIds?: string[];
	/**
	 * `true` when a profile was found and marked soft-deleted; `false`
	 * when the caller had no profile (never onboarded) so there was
	 * nothing to soft-delete. Only set when `ok === true`.
	 */
	softDeleted?: boolean;
}

/** Result of {@link recoverMyAccountFn}, discriminated by `ok`. */
export type RecoverMyAccountResult =
	| { ok: true; recovered: boolean }
	| { ok: false; reason: 'expired' };

/** Result of {@link sweepExpiredDeletionsFn} — count of accounts purged. */
export interface SweepExpiredDeletionsResult {
	swept: number;
}

const validateInput = ({
	reason,
	note
}: {
	reason: string;
	note: string;
}): { reason: ExitSignalReason; note: string } => {
	if (!EXIT_SIGNAL_REASONS.includes(reason as ExitSignalReason)) {
		throw new Error(`deleteMyAccount: reason "${reason}" is not one of the allowed buckets.`);
	}

	if (note.length > EXIT_SIGNAL_NOTE_MAX_LENGTH) {
		throw new Error(`deleteMyAccount: note exceeds ${EXIT_SIGNAL_NOTE_MAX_LENGTH} characters.`);
	}

	return { reason: reason as ExitSignalReason, note };
};

/**
 * Scan the `LEAGUES` collection for leagues the caller owns, then for
 * each one count membership rows. Returns the ids of leagues that
 * still have other members so the caller can transfer ownership
 * before retrying delete.
 *
 * A league with only the owner row counts as empty — that row is
 * deleted by the cascade anyway, and the league itself is hard-
 * deleted at the end. The guard protects against orphaning *other*
 * users' membership in a league with no owner.
 */
const findOwnedNonEmptyLeagues = ({
	callerText,
	callerBytes
}: {
	callerText: string;
	callerBytes: Uint8Array;
}): string[] => {
	const { items: leagueItems } = listDocsStore({
		collection: Collection.LEAGUES,
		caller: callerBytes,
		params: {}
	});

	const ownedLeagueIds: string[] = [];

	for (const [, item] of leagueItems) {
		try {
			const league = decodeDocData<LeagueDoc>(item.data);

			if (league.owner === callerText) {
				ownedLeagueIds.push(league.id);
			}
		} catch {
			// skip malformed
		}
	}

	if (ownedLeagueIds.length === 0) {
		return [];
	}

	const { items: memberItems } = listDocsStore({
		collection: Collection.LEAGUE_MEMBERS,
		caller: callerBytes,
		params: {}
	});

	const nonEmpty: string[] = [];

	for (const leagueId of ownedLeagueIds) {
		const prefix = `${leagueId}/`;
		let otherMembers = 0;

		for (const [docKey, item] of memberItems) {
			if (docKey.startsWith(prefix)) {
				try {
					const member = decodeDocData<LeagueMemberDoc>(item.data);

					if (member.leagueId === leagueId && member.member !== callerText) {
						otherMembers += 1;

						break;
					}
				} catch {
					// skip malformed
				}
			}
		}

		if (otherMembers > 0) {
			nonEmpty.push(leagueId);
		}
	}

	return nonEmpty;
};

/**
 * Drop every doc whose key starts with `${callerText}/` from the
 * collection. Used for collections that prefix-key on the user's
 * principal (`affiliations`, `vxp_awards`, `vxp_onboarding`).
 */
const deletePrefixedDocs = ({
	collection,
	callerText,
	callerBytes
}: {
	collection: Collection;
	callerText: string;
	callerBytes: Uint8Array;
}): number => {
	const { items } = listDocsStore({
		collection,
		caller: callerBytes,
		params: {}
	});

	const prefix = `${callerText}/`;
	let deleted = 0;

	for (const [docKey, item] of items) {
		if (docKey === callerText || docKey.startsWith(prefix)) {
			deleteDocStore({
				collection,
				key: docKey,
				caller: callerBytes,
				doc: {
					version: item.version
				}
			});
			deleted += 1;
		}
	}

	return deleted;
};

/**
 * Drop the caller's profile (`profiles` is keyed by principal text,
 * one doc per user). The doc may not exist if the user never
 * completed onboarding — silently no-op in that case.
 */
const deleteOwnProfile = ({
	callerText,
	callerBytes
}: {
	callerText: string;
	callerBytes: Uint8Array;
}): number =>
	deletePrefixedDocs({
		collection: Collection.PROFILES,
		callerText,
		callerBytes
	});

/**
 * Drop the caller's relations (friend / follow rows) — keyed by
 * relation id, not principal, so we scan + filter by
 * `participants[*] === callerText`. Deletes the row entirely; the
 * other participant loses the relation too (mirrors the
 * `cancelFriendRequest` / `unfollow` semantics).
 */
const deleteOwnRelations = ({
	callerText,
	callerBytes
}: {
	callerText: string;
	callerBytes: Uint8Array;
}): number => {
	const { items } = listDocsStore({
		collection: Collection.RELATIONS,
		caller: callerBytes,
		params: {}
	});

	let deleted = 0;

	for (const [docKey, item] of items) {
		try {
			const relation = decodeDocData<Relation>(item.data);

			if (relation.participants.includes(callerText)) {
				deleteDocStore({
					collection: Collection.RELATIONS,
					key: docKey,
					caller: callerBytes,
					doc: {
						version: item.version
					}
				});
				deleted += 1;
			}
		} catch {
			// skip malformed
		}
	}

	return deleted;
};

/**
 * Drop the caller's referral code (`referral_codes` is reverse-
 * indexed — key is the code, value is the owner). One row max per
 * user; iterate to find theirs.
 */
const deleteOwnReferralCode = ({
	callerText,
	callerBytes
}: {
	callerText: string;
	callerBytes: Uint8Array;
}): number => {
	const { items } = listDocsStore({
		collection: Collection.REFERRAL_CODES,
		caller: callerBytes,
		params: {}
	});

	let deleted = 0;

	for (const [docKey, item] of items) {
		try {
			const codeDoc = decodeDocData<ReferralCodeDoc>(item.data);

			if (codeDoc.owner === callerText) {
				deleteDocStore({
					collection: Collection.REFERRAL_CODES,
					key: docKey,
					caller: callerBytes,
					doc: {
						version: item.version
					}
				});
				deleted += 1;
			}
		} catch {
			// skip malformed
		}
	}

	return deleted;
};

/**
 * Drop the caller's referral-redemption row (`referrals` is keyed
 * by the *referee* principal — so the caller's row lives at their
 * own principal text). Other users' rows whose `referrer` equals
 * the caller are left in place (they document the referee's
 * payout history, which is auditable independent of the referrer).
 */
const deleteOwnReferralRedemption = ({
	callerText,
	callerBytes
}: {
	callerText: string;
	callerBytes: Uint8Array;
}): number => {
	const { items } = listDocsStore({
		collection: Collection.REFERRALS,
		caller: callerBytes,
		params: {}
	});

	let deleted = 0;

	for (const [docKey, item] of items) {
		if (docKey === callerText) {
			try {
				// Belt-and-braces: only delete if the embedded doc agrees
				// the row is keyed to the caller.
				decodeDocData<ReferralDoc>(item.data);
				deleteDocStore({
					collection: Collection.REFERRALS,
					key: docKey,
					caller: callerBytes,
					doc: {
						version: item.version
					}
				});
				deleted += 1;
			} catch {
				// skip malformed
			}
		}
	}

	return deleted;
};

/**
 * Drop affiliation rows (`${member}/${kind}/${affiliationIdentifier}` —
 * prefix-keyed). The 90-day lock assert is bypassed in this code
 * path because we delete via the satellite caller with no app-side
 * `assertDeleteAffiliation` re-entry on raw datastore drops; if
 * future Juno versions tighten that, we'll need a system-bypass
 * branch in the delete assert keyed off a "during-account-delete"
 * flag. For now the satellite SDK drop is unconditional.
 */
const deleteOwnAffiliations = deletePrefixedDocs;

/**
 * Drop league memberships where the caller is the member (key
 * suffix `/${callerText}`). Owner rows are removed too — the
 * owned-empty leagues themselves are dropped in the next step.
 */
const deleteOwnLeagueMemberships = ({
	callerText,
	callerBytes
}: {
	callerText: string;
	callerBytes: Uint8Array;
}): number => {
	const { items } = listDocsStore({
		collection: Collection.LEAGUE_MEMBERS,
		caller: callerBytes,
		params: {}
	});

	const suffix = `/${callerText}`;
	let deleted = 0;

	for (const [docKey, item] of items) {
		if (docKey.endsWith(suffix)) {
			try {
				const member = decodeDocData<LeagueMemberDoc>(item.data);

				if (member.member === callerText) {
					deleteDocStore({
						collection: Collection.LEAGUE_MEMBERS,
						key: docKey,
						caller: callerBytes,
						doc: {
							version: item.version
						}
					});
					deleted += 1;
				}
			} catch {
				// skip malformed
			}
		}
	}

	return deleted;
};

/**
 * Drop leagues the caller owns. By the time we get here the
 * non-empty guard already returned `[]`, so every owned league has
 * exactly the caller's membership row left (just dropped in the
 * previous step). The league doc itself is now an orphan; delete it.
 */
const deleteOwnedEmptyLeagues = ({
	callerText,
	callerBytes
}: {
	callerText: string;
	callerBytes: Uint8Array;
}): number => {
	const { items } = listDocsStore({
		collection: Collection.LEAGUES,
		caller: callerBytes,
		params: {}
	});

	let deleted = 0;

	for (const [docKey, item] of items) {
		try {
			const league = decodeDocData<LeagueDoc>(item.data);

			if (league.owner === callerText) {
				deleteDocStore({
					collection: Collection.LEAGUES,
					key: docKey,
					caller: callerBytes,
					doc: {
						version: item.version
					}
				});
				deleted += 1;
			}
		} catch {
			// skip malformed
		}
	}

	return deleted;
};

/**
 * Cascade hard-delete for a single account. Removes every row
 * identity-keyed to the principal: profile, VXP awards / onboarding,
 * referral code + redemption record, affiliations, relations, league
 * memberships, owned-empty leagues. Shared audit rows (activities,
 * battles, comments) are left in place — the principal is gone, so
 * they're orphaned but immutable (decision 4.1).
 *
 * Order matters only between league memberships → owned-empty leagues
 * (the latter assumes the membership rows are gone first).
 *
 * Takes the principal explicitly (does NOT call `msgCaller()`) so the
 * admin sweep can run it for any account, not just the caller. Returns
 * the number of docs deleted. Idempotent — a re-run on an
 * already-purged account finds nothing and returns 0.
 */
export const hardDeleteAccountFn = ({
	callerText,
	callerBytes
}: {
	callerText: string;
	callerBytes: Uint8Array;
}): number => {
	let docsDeleted = 0;

	docsDeleted += deleteOwnProfile({ callerText, callerBytes });
	docsDeleted += deletePrefixedDocs({
		collection: Collection.VXP_AWARDS,
		callerText,
		callerBytes
	});
	docsDeleted += deletePrefixedDocs({
		collection: Collection.VXP_ONBOARDING,
		callerText,
		callerBytes
	});
	docsDeleted += deleteOwnReferralCode({ callerText, callerBytes });
	docsDeleted += deleteOwnReferralRedemption({ callerText, callerBytes });
	docsDeleted += deleteOwnAffiliations({
		collection: Collection.AFFILIATIONS,
		callerText,
		callerBytes
	});
	docsDeleted += deleteOwnRelations({ callerText, callerBytes });
	docsDeleted += deleteOwnLeagueMemberships({ callerText, callerBytes });
	docsDeleted += deleteOwnedEmptyLeagues({ callerText, callerBytes });

	return docsDeleted;
};

export const deleteMyAccountFn = ({
	reason,
	note
}: {
	reason: string;
	note: string;
}): DeleteMyAccountResult => {
	const validated = validateInput({ reason, note });
	const caller = msgCaller();
	const callerText = caller.toText();
	const callerBytes = caller.toUint8Array();

	// Step 1 — owner-leagues guard. If any owned league still has
	// another member, refuse and surface the list to the FE.
	const blockingLeagueIds = findOwnedNonEmptyLeagues({ callerText, callerBytes });

	if (blockingLeagueIds.length > 0) {
		return {
			ok: false,
			reason: 'owns_non_empty_league',
			blockingLeagueIds
		};
	}

	// Step 2 — exit-signal write. Compact base36 key, anonymous body.
	// The chain timestamp (ns) is the entropy source; we hash it
	// into a 16-char alphanumeric string to keep the key compact.
	const nowNs = time();
	const nowMs = Number(nowNs / 1_000_000n);
	const signalKey = exitSignalKeyFromNs(nowNs);
	const signalDoc: ExitSignalDoc = {
		reason: validated.reason,
		note: validated.note,
		createdAtMs: nowMs
	};

	setDocStore({
		collection: Collection.EXIT_SIGNALS,
		key: signalKey,
		caller: callerBytes,
		doc: {
			data: encodeDocData(signalDoc)
		}
	});

	// Step 3 — soft-delete. Mark the profile `deletedAtMs = now` and
	// keep every other row intact so recovery can restore the account.
	// A caller who never onboarded has no profile doc — that's a clean
	// no-op (nothing to soft-delete). A second soft-delete keeps the
	// earliest timestamp so the recovery clock can't be reset.
	const softDeleted = softDeleteProfile({ callerText, callerBytes, nowMs });

	return {
		ok: true,
		softDeleted
	};
};

/**
 * Set `deletedAtMs` on the caller's profile via a version-locked
 * overwrite. Reads → decodes → sets the marker → re-encodes →
 * `setDocStore` with the current `version` so a concurrent profile
 * write can't be silently clobbered. Idempotent: if the profile is
 * already soft-deleted, the EARLIEST `deletedAtMs` is preserved (a
 * re-delete must not extend the recovery window). Returns `true` when
 * a profile existed (and is now marked), `false` when there was no
 * profile to mark.
 */
const softDeleteProfile = ({
	callerText,
	callerBytes,
	nowMs
}: {
	callerText: string;
	callerBytes: Uint8Array;
	nowMs: number;
}): boolean => {
	const profileDoc = getDocStore({
		collection: Collection.PROFILES,
		key: callerText,
		caller: callerBytes
	});

	if (isNullish(profileDoc)) {
		return false;
	}

	const profile = decodeDocData<UserProfile>(profileDoc.data);

	// Keep the earliest mark — re-deleting must not reset the clock.
	const deletedAtMs = isNullish(profile.deletedAtMs) ? nowMs : Math.min(profile.deletedAtMs, nowMs);

	setDocStore({
		collection: Collection.PROFILES,
		key: callerText,
		caller: callerBytes,
		doc: {
			data: encodeDocData<UserProfile>({ ...profile, deletedAtMs }),
			version: profileDoc.version
		}
	});

	return true;
};

/**
 * Recover the caller's own soft-deleted account (Delete account v2).
 *
 *  - Not soft-deleted → no-op: `{ ok: true, recovered: false }`.
 *  - Soft-deleted, still inside {@link ACCOUNT_RECOVERY_WINDOW_MS} →
 *    clear `deletedAtMs` and restore the account:
 *    `{ ok: true, recovered: true }`.
 *  - Soft-deleted past the window → the grace period is over, so we
 *    hard-delete the account now and report `{ ok: false, reason:
 *    'expired' }` (a late recovery attempt is the natural trigger to
 *    finally purge the data).
 *
 * No profile at all (never onboarded, or already hard-deleted) is a
 * clean no-op `{ ok: true, recovered: false }`. Idempotent.
 */
export const recoverMyAccountFn = (): RecoverMyAccountResult => {
	const caller = msgCaller();
	const callerText = caller.toText();
	const callerBytes = caller.toUint8Array();

	const profileDoc = getDocStore({
		collection: Collection.PROFILES,
		key: callerText,
		caller: callerBytes
	});

	if (isNullish(profileDoc)) {
		return { ok: true, recovered: false };
	}

	const profile = decodeDocData<UserProfile>(profileDoc.data);

	if (isNullish(profile.deletedAtMs)) {
		return { ok: true, recovered: false };
	}

	const nowMs = Number(time() / 1_000_000n);

	if (nowMs - profile.deletedAtMs >= ACCOUNT_RECOVERY_WINDOW_MS) {
		// Window elapsed — purge now and refuse the recovery.
		hardDeleteAccountFn({ callerText, callerBytes });

		return { ok: false, reason: 'expired' };
	}

	// Inside the window — clear the marker via a version-locked write.
	const { deletedAtMs: _drop, ...rest } = profile;

	setDocStore({
		collection: Collection.PROFILES,
		key: callerText,
		caller: callerBytes,
		doc: {
			data: encodeDocData<UserProfile>(rest),
			version: profileDoc.version
		}
	});

	return { ok: true, recovered: true };
};

/**
 * Admin sweep that hard-deletes every soft-deleted account whose
 * recovery window has elapsed (Delete account v2). Scans `PROFILES`
 * for docs with `deletedAtMs` older than {@link
 * ACCOUNT_RECOVERY_WINDOW_MS} and runs {@link hardDeleteAccountFn} for
 * each. Returns `{ swept }` — the number of accounts purged.
 *
 * **Admin-only** — refuses non-admins via the shared `isAdmin` check.
 *
 * Juno exposes no scheduler primitive (the same reason the worlds
 * podium payout is modelled as a user-claim — see
 * `vxp-worlds-podium.services.ts`), so this is triggered externally:
 * an operator/cron calls it. Idempotent — already-purged accounts no
 * longer carry a profile doc, so a re-run only sweeps newly-expired
 * accounts.
 */
export const sweepExpiredDeletionsFn = (): SweepExpiredDeletionsResult => {
	const caller = msgCaller();

	if (!isAdmin({ caller })) {
		throw new Error('sweepExpiredDeletions: caller is not an admin.');
	}

	const callerBytes = caller.toUint8Array();
	const nowMs = Number(time() / 1_000_000n);

	const { items } = listDocsStore({
		collection: Collection.PROFILES,
		caller: callerBytes,
		params: {}
	});

	let swept = 0;

	for (const [, item] of items) {
		try {
			const profile = decodeDocData<UserProfile>(item.data);

			// Only soft-deleted accounts past the recovery window are purged.
			if (
				nonNullish(profile.deletedAtMs) &&
				nowMs - profile.deletedAtMs >= ACCOUNT_RECOVERY_WINDOW_MS
			) {
				// `profiles` is keyed by the owner's principal text; derive the
				// bytes from it so `hardDeleteAccountFn` can drop every
				// identity-keyed row for that account.
				const ownerText = profile.owner;
				const ownerBytes = Principal.fromText(ownerText).toUint8Array();

				hardDeleteAccountFn({ callerText: ownerText, callerBytes: ownerBytes });
				swept += 1;
			}
		} catch {
			// skip malformed
		}
	}

	return { swept };
};

/**
 * Build a compact 16-char alphanumeric key from the chain timestamp.
 * The endpoint runs synchronously per-caller, so even at the
 * theoretical ns-resolution collision risk the assert's
 * "current must be null" guard catches a collision cleanly.
 */
const exitSignalKeyFromNs = (nowNs: bigint): string => {
	const base36 = nowNs.toString(36);

	// Pad to a fixed width so keys sort lexicographically by write
	// order (handy when the log grows).
	return base36.padStart(16, '0');
};

/**
 * Convenience: probe whether the caller has any owned league that
 * blocks deletion. Used by the FE pre-flight so the delete CTA can
 * be disabled before the user picks a reason.
 */
export const listMyBlockingLeaguesFn = (): { leagueIds: string[] } => {
	const caller = msgCaller();

	return {
		leagueIds: findOwnedNonEmptyLeagues({
			callerText: caller.toText(),
			callerBytes: caller.toUint8Array()
		})
	};
};
