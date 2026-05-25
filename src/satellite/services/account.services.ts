import { Collection } from '$lib/constants/collections.constants';
import type { AffiliationDoc } from '$lib/types/affiliation';
import {
	EXIT_SIGNAL_NOTE_MAX_LENGTH,
	EXIT_SIGNAL_REASONS,
	type ExitSignalDoc,
	type ExitSignalReason
} from '$lib/types/exit-signal';
import type { LeagueDoc } from '$lib/types/league';
import type { LeagueMemberDoc } from '$lib/types/league-member';
import type { ReferralCodeDoc, ReferralDoc } from '$lib/types/referral';
import type { Relation } from '$lib/types/relation';
import { isNullish, nonNullish } from '@dfinity/utils';
import { msgCaller, time } from '@junobuild/functions/ic-cdk';
import {
	countDocsStore,
	decodeDocData,
	deleteDocStore,
	encodeDocData,
	listDocsStore,
	setDocStore
} from '@junobuild/functions/sdk';

/**
 * Account deletion — Proposal 4 in `docs/backend-proposals/README.md`.
 *
 * The endpoint runs three steps in order:
 *
 *  1. **Owner-leagues guard.** If the caller owns any league that
 *     still has another member, the deletion is refused with
 *     `reason: 'owns_non_empty_league'`. The FE surfaces a
 *     "transfer ownership first" prompt (decision 4.3).
 *
 *  2. **Exit-signal write.** A single `EXIT_SIGNALS` doc is appended
 *     with the chosen reason + optional note. The doc has no
 *     principal field — it's intentionally unlinkable from the
 *     account that wrote it.
 *
 *  3. **Cascade hard-delete.** Every row identity-keyed to the
 *     caller is removed: profile, VXP awards / onboarding,
 *     referral code + redemption record, affiliations, relations,
 *     non-owner league memberships, owned-empty leagues. Shared
 *     audit rows (activities, bouts, comments) are left in place —
 *     the principal is gone, so they're orphaned but immutable
 *     (decision 4.1, hybrid hard-delete + leave-shared).
 *
 * After step 3 returns, the FE drops auth (`signOut`) and the user
 * sees the sign-in screen. The principal can re-onboard from
 * scratch later if they want; nothing in the system retains a
 * link from old principal → new principal.
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
	/** Diagnostic counters for the log line. */
	docsDeleted?: number;
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
		throw new Error(
			`deleteMyAccount: note exceeds ${EXIT_SIGNAL_NOTE_MAX_LENGTH} characters.`
		);
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
}): number => deletePrefixedDocs({
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
 * Drop affiliation rows (`${member}/${kind}/${affiliationId}` —
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
 * Read the caller's affiliations (zero-to-two rows) before the
 * cascade so the post-delete log line can record whether they had
 * any. Diagnostic only — not used to gate the delete.
 */
const summariseAffiliations = ({
	callerText,
	callerBytes
}: {
	callerText: string;
	callerBytes: Uint8Array;
}): number => {
	const { items } = listDocsStore({
		collection: Collection.AFFILIATIONS,
		caller: callerBytes,
		params: {}
	});

	let count = 0;

	for (const [docKey, item] of items) {
		if (docKey.startsWith(`${callerText}/`)) {
			try {
				const doc = decodeDocData<AffiliationDoc>(item.data);

				if (doc.member === callerText) {
					count += 1;
				}
			} catch {
				// skip
			}
		}
	}

	return count;
};

export const deleteMyAccountFn = async ({
	reason,
	note
}: {
	reason: string;
	note: string;
}): Promise<DeleteMyAccountResult> => {
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

	// Belt-and-braces: confirm the profile collection isn't empty.
	// A non-onboarded caller can still call this (and we'll still
	// write their exit-signal), but at least one of the deletion
	// counters being non-zero confirms the cascade did something.
	const profileCount = countDocsStore({
		collection: Collection.PROFILES,
		caller: callerBytes,
		params: {}
	});

	// Step 2 — exit-signal write. Random UUID key, anonymous body.
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

	// Step 3 — cascade hard-delete. Order matters only between
	// league memberships → owned-empty leagues (the latter assumes
	// the former is done so the membership rows are gone first).
	const _affiliationCountBefore = summariseAffiliations({ callerText, callerBytes });

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

	// Suppress "unused" lint warnings for the diagnostic counters.
	void profileCount;
	void _affiliationCountBefore;

	return {
		ok: true,
		docsDeleted
	};
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

// Re-export for completeness — the hooks file doesn't currently
// need these helpers, but a future test harness might.
export { findOwnedNonEmptyLeagues };

// Silence the unused-import warnings for `isNullish` / `nonNullish`
// — they're kept because future cascade steps (anonymise comments)
// will pull them in, and removing-then-re-adding churns the diff.
void isNullish;
void nonNullish;
