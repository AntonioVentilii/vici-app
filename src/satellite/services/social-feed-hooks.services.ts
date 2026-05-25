import { Collection } from '$lib/constants/collections.constants';
import type { AffiliationDoc } from '$lib/types/affiliation';
import type { BoutDoc, BoutState } from '$lib/types/bout';
import type { LeagueMemberDoc } from '$lib/types/league-member';
import {
	socialFeedKey,
	type SocialFeedEntryDoc,
	type SocialFeedEntryKind
} from '$lib/types/social-feed';
import { isNullish, nonNullish } from '@dfinity/utils';
import type { OnSetDocContext } from '@junobuild/functions';
import { time } from '@junobuild/functions/ic-cdk';
import { decodeDocData, encodeDocData, setDocStore } from '@junobuild/functions/sdk';

/**
 * Social-feed write-fan-out hooks. Each runs *after* a successful
 * write to its source collection and composes a `SocialFeedEntryDoc`
 * via the same caller principal that triggered the original write —
 * so `assertSetSocialFeedEntry` accepts the entry (actor-binds-caller)
 * without the satellite needing to spoof identities.
 *
 * Entries are best-effort: a failure here surfaces as a logged error
 * but doesn't roll back the original write. The user already joined
 * the league / proposed the bout / claimed the affiliation; missing a
 * feed row is a UX miss, not a correctness break.
 */

const fireFeedEntry = ({
	actor,
	kind,
	refId,
	context,
	caller
}: {
	actor: string;
	kind: SocialFeedEntryKind;
	refId: string;
	context?: string;
	caller: Uint8Array;
}): void => {
	const createdAtMs = Number(time() / 1_000_000n);
	const key = socialFeedKey({ createdAtMs, actor, kind, refId });
	const entry: SocialFeedEntryDoc = {
		actor,
		kind,
		refId,
		createdAtMs,
		...(nonNullish(context) ? { context } : {})
	};

	try {
		setDocStore({
			collection: Collection.SOCIAL_FEED,
			key,
			caller,
			doc: {
				data: encodeDocData<SocialFeedEntryDoc>(entry)
			}
		});
	} catch {
		// Best-effort — the source write already landed. Swallow so a
		// feed hiccup doesn't bubble up as a write failure to the user.
	}
};

/**
 * Fire a `league_joined` feed entry on first-time membership writes.
 * Re-writes of an existing row (role promotions) don't fire — those
 * land as a separate role-changed entry kind in a future expansion.
 */
export const onLeagueMemberSetForFeed = ({
	caller,
	data: {
		data: { before, after }
	}
}: OnSetDocContext): void => {
	if (nonNullish(before)) {
		return;
	}

	try {
		const doc = decodeDocData<LeagueMemberDoc>(after.data);
		fireFeedEntry({
			actor: doc.member,
			kind: 'league_joined',
			refId: doc.leagueId,
			caller
		});
	} catch {
		// malformed source — skip
	}
};

/**
 * Fire a state-transition feed entry on bout writes. Maps:
 *
 *   - creation                  → 'bout_proposed'
 *   - proposed → accepted       → 'bout_accepted'
 *   - in_flight → resolved      → 'bout_resolved' (with winner context)
 *
 * Other transitions (accepted → in_flight) don't fire a feed entry
 * since "kickoff" is implicit in the bout's window starting; users
 * see in_flight bouts on the league detail panel without needing a
 * feed notification.
 */
export const onBoutSetForFeed = ({
	caller,
	data: {
		data: { before, after }
	}
}: OnSetDocContext): void => {
	let proposedDoc: BoutDoc;

	try {
		proposedDoc = decodeDocData<BoutDoc>(after.data);
	} catch {
		return;
	}

	let previousState: BoutState | null = null;

	if (nonNullish(before)) {
		try {
			previousState = decodeDocData<BoutDoc>(before.data).state;
		} catch {
			previousState = null;
		}
	}

	const isCreate = isNullish(before);

	if (isCreate && proposedDoc.state === 'proposed') {
		fireFeedEntry({
			actor: proposedDoc.proposer,
			kind: 'bout_proposed',
			refId: proposedDoc.id,
			caller
		});

		return;
	}

	if (previousState === 'proposed' && proposedDoc.state === 'accepted') {
		fireFeedEntry({
			actor: proposedDoc.proposer,
			kind: 'bout_accepted',
			refId: proposedDoc.id,
			caller
		});

		return;
	}

	if (previousState === 'in_flight' && proposedDoc.state === 'resolved') {
		const winnerContext =
			proposedDoc.winner === undefined
				? undefined
				: proposedDoc.winner === 'draw'
					? 'draw'
					: `winner:${proposedDoc.winner === 'A' ? proposedDoc.sideA : proposedDoc.sideB}`;

		fireFeedEntry({
			actor: proposedDoc.proposer,
			kind: 'bout_resolved',
			refId: proposedDoc.id,
			context: winnerContext,
			caller
		});
	}
};

/**
 * Fire an `affiliation_set` entry on first-write affiliation rows.
 * Re-writes (role changes) don't fire — the assert blocks meaningful
 * mutation anyway since identity fields are immutable.
 */
export const onAffiliationSetForFeed = ({
	caller,
	data: {
		data: { before, after }
	}
}: OnSetDocContext): void => {
	if (nonNullish(before)) {
		return;
	}

	try {
		const doc = decodeDocData<AffiliationDoc>(after.data);
		fireFeedEntry({
			actor: doc.member,
			kind: 'affiliation_set',
			refId: `${doc.kind}/${doc.affiliationId}`,
			context: doc.kind,
			caller
		});
	} catch {
		// malformed source — skip
	}
};
