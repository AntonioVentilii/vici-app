import { Collection } from '$lib/constants/collections.constants';
import {
	SOCIAL_FEED_CONTEXT_MAX_LENGTH,
	SOCIAL_FEED_ENTRY_KINDS,
	socialFeedKey,
	type SocialFeedEntryDoc
} from '$lib/types/social-feed';
import { isNullish, nonNullish } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';
import type { AssertSetDocContext } from '@junobuild/functions';
import { time } from '@junobuild/functions/ic-cdk';
import { decodeDocData } from '@junobuild/functions/sdk';

/**
 * Pre-write guard for `social_feed`. The feed is append-only, so the
 * rules are tight:
 *
 *  1. **Key shape.** Doc key matches `${createdAtMs}/${actor}/${kind}/${refId}`
 *     with a 13-char zero-padded ms prefix (per `socialFeedKey`).
 *  2. **Actor binds caller.** A user can only write entries on their
 *     own behalf. Hooks running under the satellite's identity write
 *     as the relevant actor's principal, so even system-generated
 *     entries flow through this rule cleanly.
 *  3. **Kind validation.** Must be one of the known event kinds.
 *  4. **Context length.** ≤240 chars to keep feed reads cheap.
 *  5. **Timestamp sanity.** `createdAtMs` within ±10 minutes of the
 *     satellite clock — defends against backdated entries that
 *     would jump the chronological queue.
 *  6. **Append-only.** Edits are rejected outright. The feed is a
 *     log, not a state machine; corrections need a follow-up entry.
 */
export const assertSetSocialFeedEntry = ({
	caller,
	data: {
		collection,
		key,
		data: { current, proposed }
	}
}: AssertSetDocContext): void => {
	if (collection !== Collection.SOCIAL_FEED) {
		return;
	}

	// 6. Append-only.
	if (nonNullish(current)) {
		throw new Error('social_feed entries are append-only; edits are rejected.');
	}

	const proposedDoc = decodeDocData<SocialFeedEntryDoc>(proposed.data);

	// 1. Key shape.
	const expectedKey = socialFeedKey({
		createdAtMs: proposedDoc.createdAtMs,
		actor: proposedDoc.actor,
		kind: proposedDoc.kind,
		refId: proposedDoc.refId
	});

	if (key !== expectedKey) {
		throw new Error(
			`social_feed key mismatch: expected ${expectedKey}, got ${key} (createdAtMs/actor/kind/refId must match the doc body).`
		);
	}

	// 3. Kind validation.
	if (!SOCIAL_FEED_ENTRY_KINDS.has(proposedDoc.kind)) {
		throw new Error(
			`social_feed kind must be one of ${[...SOCIAL_FEED_ENTRY_KINDS].join(' | ')} (got "${proposedDoc.kind}").`
		);
	}

	// 4. Context length.
	if (
		nonNullish(proposedDoc.context) &&
		proposedDoc.context.length > SOCIAL_FEED_CONTEXT_MAX_LENGTH
	) {
		throw new Error(`social_feed context must be at most ${SOCIAL_FEED_CONTEXT_MAX_LENGTH} chars.`);
	}

	// 2. Actor binds caller.
	try {
		Principal.fromText(proposedDoc.actor);
	} catch {
		throw new Error('social_feed actor must be a valid principal text.');
	}

	const callerText = Principal.fromUint8Array(caller).toText();

	if (proposedDoc.actor !== callerText) {
		throw new Error('social_feed actor must match the caller principal.');
	}

	// 5. Timestamp sanity. `time()` returns nanoseconds; convert to ms.
	if (isNullish(proposedDoc.createdAtMs)) {
		throw new Error('social_feed createdAtMs is required.');
	}

	const nowMs = Number(time() / 1_000_000n);
	const driftMs = Math.abs(nowMs - proposedDoc.createdAtMs);
	const TEN_MINUTES_MS = 10 * 60 * 1000;

	if (driftMs > TEN_MINUTES_MS) {
		throw new Error('social_feed createdAtMs must be within ±10 minutes of the satellite clock.');
	}
};
