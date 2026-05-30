import { Collection } from '$lib/constants/collections.constants';
import { RelationCategory, RelationState } from '$lib/enums/relation';
import type { Relation } from '$lib/types/relation';
import { isNullish } from '@dfinity/utils';
import { msgCaller } from '@junobuild/functions/ic-cdk';
import {
	decodeDocData,
	deleteDocStore,
	encodeDocData,
	getDocStore,
	listDocsStore,
	setDocStore
} from '@junobuild/functions/sdk';
import type { PrincipalText } from '@junobuild/schema';

export const listFriends = (): Relation[] => {
	const caller = msgCaller();

	const callerText = caller.toText();

	const { items } = listDocsStore({
		collection: Collection.RELATIONS,
		caller,
		params: {}
	});

	return items
		.map(([_, item]) => decodeDocData<Relation>(item.data))
		.filter(
			(r) =>
				r.category === RelationCategory.FRIEND &&
				r.state === RelationState.ACTIVE &&
				r.participants.includes(callerText)
		);
};

export const listFollowers = (): Relation[] => {
	const caller = msgCaller();

	const callerText = caller.toText();

	const { items } = listDocsStore({
		collection: Collection.RELATIONS,
		caller,
		params: {}
	});

	return items
		.map(([_, item]) => decodeDocData<Relation>(item.data))
		.filter(
			(r) =>
				r.category === RelationCategory.FOLLOW &&
				r.state === RelationState.ACTIVE &&
				r.participants[1] === callerText
		);
};

export const listFollowing = (): Relation[] => {
	const caller = msgCaller();

	const callerText = caller.toText();

	const { items } = listDocsStore({
		collection: Collection.RELATIONS,
		caller,
		params: {}
	});

	return items
		.map(([_, item]) => decodeDocData<Relation>(item.data))
		.filter(
			(r) =>
				r.category === RelationCategory.FOLLOW &&
				r.state === RelationState.ACTIVE &&
				r.participants[0] === callerText
		);
};

export const checkFriendship = ({
	userA,
	userB
}: {
	userA: PrincipalText;
	userB: PrincipalText;
}): boolean => {
	const caller = msgCaller();

	const relationId = [userA, userB].sort().join('#');

	const doc = getDocStore({
		collection: Collection.RELATIONS,
		key: relationId,
		caller
	});

	if (isNullish(doc)) {
		return false;
	}

	const relation = decodeDocData<Relation>(doc.data);

	return relation.category === RelationCategory.FRIEND && relation.state === RelationState.ACTIVE;
};

export const listFriendRequests = (): Relation[] => {
	const caller = msgCaller();

	const callerText = caller.toText();

	const { items } = listDocsStore({
		collection: Collection.RELATIONS,
		caller,
		params: {}
	});

	return items
		.map(([_, item]) => decodeDocData<Relation>(item.data))
		.filter(
			(r) =>
				r.category === RelationCategory.FRIEND &&
				r.state === RelationState.PENDING &&
				r.participants[1] === callerText
		);
};

/**
 * Lists pending friend requests where the caller is the **sender**
 * (`participants[0]`). Mirror of {@link listFriendRequests}, which only
 * surfaces requests where the caller is the recipient.
 */
export const listSentFriendRequests = (): Relation[] => {
	const caller = msgCaller();

	const callerText = caller.toText();

	const { items } = listDocsStore({
		collection: Collection.RELATIONS,
		caller,
		params: {}
	});

	return items
		.map(([_, item]) => decodeDocData<Relation>(item.data))
		.filter(
			(r) =>
				r.category === RelationCategory.FRIEND &&
				r.state === RelationState.PENDING &&
				r.participants[0] === callerText
		);
};

export const sendFriendRequest = ({ target }: { target: PrincipalText }): void => {
	const caller = msgCaller();

	const sender = caller.toText();

	const relationId = [sender, target].sort().join('#');

	const existingDoc = getDocStore({
		collection: Collection.RELATIONS,
		key: relationId,
		caller
	});

	if (!isNullish(existingDoc)) {
		const existing = decodeDocData<Relation>(existingDoc.data);
		throw new Error(`Friend request already exists with state: ${existing.state}`);
	}

	const relation: Relation = {
		category: RelationCategory.FRIEND,
		state: RelationState.PENDING,
		participants: [sender, target]
	};

	setDocStore({
		collection: Collection.RELATIONS,
		key: relationId,
		doc: {
			data: encodeDocData(relation)
		},
		caller
	});
};

export const acceptFriendRequest = ({ relationId }: { relationId: string }): void => {
	const caller = msgCaller();

	const callerText = caller.toText();

	const doc = getDocStore({
		collection: Collection.RELATIONS,
		key: relationId,
		caller
	});

	if (isNullish(doc)) {
		throw new Error('Relation does not exist');
	}

	const relation = decodeDocData<Relation>(doc.data);

	if (relation.participants[1] !== callerText) {
		throw new Error('Only the recipient can accept a friend request.');
	}

	setDocStore({
		collection: Collection.RELATIONS,
		key: relationId,
		doc: {
			version: doc.version,
			data: encodeDocData({
				...relation,
				state: RelationState.ACTIVE
			})
		},
		caller
	});
};

/**
 * Cancels a friend request the caller previously sent.
 *
 * Atomicity: the cancel only succeeds if the relation is still
 * {@link RelationState.PENDING} **and** its on-chain `version` matches the
 * one we just read. If the recipient accepted/rejected in the meantime,
 * the doc's `version` was bumped, `deleteDocStore` traps with a
 * version-mismatch error, and the cancel is rejected — exactly the
 * "nanosecond" race the caller asked us to guard against. We also
 * deliberately do **not** "transition to a CANCELLED state" because that
 * would be a second write that itself races with the recipient's accept;
 * a versioned delete is the only single-write, conflict-detecting move
 * the Juno datastore exposes.
 */
export const cancelFriendRequest = ({ relationId }: { relationId: string }): void => {
	const caller = msgCaller();

	const callerText = caller.toText();

	const doc = getDocStore({
		collection: Collection.RELATIONS,
		key: relationId,
		caller
	});

	if (isNullish(doc)) {
		throw new Error('Relation does not exist');
	}

	const relation = decodeDocData<Relation>(doc.data);

	if (relation.category !== RelationCategory.FRIEND) {
		throw new Error('Only friend requests can be cancelled.');
	}

	if (relation.participants[0] !== callerText) {
		throw new Error('Only the sender can cancel a friend request.');
	}

	if (relation.state !== RelationState.PENDING) {
		throw new Error(`Cannot cancel a request in state "${relation.state}".`);
	}

	deleteDocStore({
		collection: Collection.RELATIONS,
		key: relationId,
		doc: {
			version: doc.version
		},
		caller
	});
};

export const rejectFriendRequest = ({ relationId }: { relationId: string }): void => {
	const caller = msgCaller();

	const callerText = caller.toText();

	const doc = getDocStore({
		collection: Collection.RELATIONS,
		key: relationId,
		caller
	});

	if (isNullish(doc)) {
		throw new Error('Relation does not exist');
	}

	const relation = decodeDocData<Relation>(doc.data);

	if (relation.participants[1] !== callerText) {
		throw new Error('Only the recipient can reject a friend request.');
	}

	setDocStore({
		collection: Collection.RELATIONS,
		key: relationId,
		doc: {
			version: doc.version,
			data: encodeDocData({
				...relation,
				state: RelationState.REJECTED
			})
		},
		caller
	});
};

export const followUser = ({ target }: { target: PrincipalText }): void => {
	const caller = msgCaller();

	const sender = caller.toText();

	const relationId = `follow#${sender}#${target}`;

	const relation: Relation = {
		category: RelationCategory.FOLLOW,
		state: RelationState.ACTIVE,
		participants: [sender, target]
	};

	setDocStore({
		collection: Collection.RELATIONS,
		key: relationId,
		doc: {
			data: encodeDocData(relation)
		},
		caller
	});
};
