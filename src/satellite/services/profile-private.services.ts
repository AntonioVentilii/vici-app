import { Collection } from '$lib/constants/collections.constants';
import type { ProfilePrivate, UserProfile } from '$lib/types/profile';
import { isAdmin } from '$satellite/services/_authz';
import { logError } from '$satellite/utils/logger.utils';
import { nonNullish } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';
import type { AssertSetDocContext } from '@junobuild/functions';
import { msgCaller } from '@junobuild/functions/ic-cdk';
import {
	decodeDocData,
	encodeDocData,
	getDocStore,
	listDocsStore,
	setDocStore
} from '@junobuild/functions/sdk';

/**
 * Upper bound for a stored address — the RFC 5321 path limit. The doc is
 * owner-written, so this is a bloat guard, not format validation (the FE
 * and the OpenID provider own that).
 */
const MAX_EMAIL_LENGTH = 320;

/**
 * Set-doc assertion for the `profile_private` collection. The collection
 * is `managed` (owner + controllers), but `managed` still lets any
 * authenticated user CREATE a doc under an arbitrary free key — so
 * without this guard a third party could squat another user's principal
 * key before their first write, blocking (or forging) the email the
 * server-side consumers read by key. Bind both the doc key and the
 * embedded `owner` to the caller: a private profile doc can only ever
 * live under its own principal.
 */
export const assertSetProfilePrivate = ({
	caller,
	data: {
		collection,
		key,
		data: { proposed }
	}
}: AssertSetDocContext): void => {
	if (collection !== Collection.PROFILE_PRIVATE) {
		return;
	}

	const callerText = Principal.fromUint8Array(caller).toText();

	if (key !== callerText) {
		throw new Error('A private profile doc can only be written under the caller principal.');
	}

	const data = decodeDocData<ProfilePrivate>(proposed.data);

	if (data.owner !== callerText) {
		throw new Error('Private profile owner must match the caller.');
	}

	if (typeof data.email !== 'string' || data.email.length > MAX_EMAIL_LENGTH) {
		throw new Error(`Private profile email must be a string of at most ${MAX_EMAIL_LENGTH} chars.`);
	}
};

/**
 * Page ceiling for {@link migrateProfileEmailsFn}. Every `profiles` rewrite
 * re-runs the set-doc asserts, and the nickname-uniqueness assert scans the
 * whole collection per write — so an unpaged migration is quadratic and
 * blew the 40B-instruction message limit on the first prod run. A page of
 * 10 keeps each call comfortably inside the budget.
 */
const MAX_MIGRATION_LIMIT = 10;

/** Outcome of one {@link migrateProfileEmailsFn} page. */
export interface MigrateProfileEmailsResult {
	/** `profiles` docs scanned in this page. */
	scanned: number;
	/** Non-empty addresses copied into `profile_private`. */
	migrated: number;
	/** `profiles` docs rewritten without their legacy `email` field. */
	cleared: number;
	/** Docs left untouched because a step failed (logged; re-run to retry). */
	skipped: number;
	/** Cursor for the next page — absent once the collection is exhausted. */
	nextKey?: string;
	/** `true` while another page may remain. */
	hasMore: boolean;
}

/**
 * One-time migration for the email-exposure fix: moves every legacy
 * `email` still stored on a public `profiles` doc into the caller-only
 * `profile_private` collection, then rewrites the public doc WITHOUT the
 * field. Admin-gated and idempotent — docs that carry no `email` key are
 * skipped, and a stored private address is never overwritten (the public
 * copy is still cleared), so a re-run only retries previously-failed rows.
 *
 * Keyset-paged (same discipline as the analytics exports): each call
 * processes at most {@link MAX_MIGRATION_LIMIT} docs after `afterKey` in
 * the datastore's native key order; the caller loops with the returned
 * `nextKey` until `hasMore` is `false`.
 *
 * Both writes pass the OWNER's principal as the store caller, so the
 * private doc lands owner-owned (the user can read/update it under the
 * `managed` rule and {@link assertSetProfilePrivate} holds) and the
 * public rewrite is version-locked against a concurrent client write.
 * Store asserts still run on these serverless writes; every field except
 * `email` round-trips unchanged, so the profile asserts pass. A doc that
 * still fails (e.g. a legacy nickname collision vetoed by the nickname
 * assert) is counted in `skipped` and logged for manual follow-up.
 */
export const migrateProfileEmailsFn = ({
	afterKey
}: {
	afterKey?: string;
}): MigrateProfileEmailsResult => {
	const caller = msgCaller();

	if (!isAdmin({ caller })) {
		throw new Error('Only an admin can migrate profile emails.');
	}

	const afterKeyText = afterKey?.trim() ?? '';

	const { items } = listDocsStore({
		collection: Collection.PROFILES,
		caller,
		params: {
			paginate: {
				limit: BigInt(MAX_MIGRATION_LIMIT),
				start_after: afterKeyText.length > 0 ? afterKeyText : undefined
			}
		}
	});

	let migrated = 0;
	let cleared = 0;
	let skipped = 0;

	for (const [key, doc] of items) {
		try {
			// Legacy rows carry `email` even though the schema no longer
			// declares it — decode with the field re-attached so it can be
			// read once and dropped. Rows a previous run (or a post-fix
			// client write) already stripped carry no `email` key at all —
			// nothing to migrate or rewrite for those.
			const profile = decodeDocData<UserProfile & { email?: string }>(doc.data);

			if (nonNullish(profile.email)) {
				const email = profile.email.trim();
				const ownerBytes = Principal.fromText(key).toUint8Array();

				if (email.length > 0) {
					const existingPrivate = getDocStore({
						collection: Collection.PROFILE_PRIVATE,
						key,
						caller: ownerBytes
					});

					const existingEmail = nonNullish(existingPrivate)
						? (decodeDocData<ProfilePrivate>(existingPrivate.data).email ?? '').trim()
						: '';

					// Never overwrite an address the owner already holds privately —
					// the public copy is stale by definition once the private doc
					// exists.
					if (existingEmail.length === 0) {
						setDocStore({
							collection: Collection.PROFILE_PRIVATE,
							key,
							caller: ownerBytes,
							doc: {
								data: encodeDocData<ProfilePrivate>({ owner: key, email }),
								...(nonNullish(existingPrivate) && { version: existingPrivate.version })
							}
						});
						migrated += 1;
					}
				}

				const { email: _drop, ...publicProfile } = profile;

				setDocStore({
					collection: Collection.PROFILES,
					key,
					caller: ownerBytes,
					doc: {
						data: encodeDocData<UserProfile>(publicProfile),
						version: doc.version
					}
				});
				cleared += 1;
			}
		} catch (err) {
			skipped += 1;
			logError({
				message: 'profile_email_migration_skipped',
				detail: { key, error: err instanceof Error ? err.message : `${err}` }
			});
		}
	}

	return {
		scanned: items.length,
		migrated,
		cleared,
		skipped,
		nextKey: items.length > 0 ? items[items.length - 1][0] : undefined,
		hasMore: items.length >= MAX_MIGRATION_LIMIT
	};
};
