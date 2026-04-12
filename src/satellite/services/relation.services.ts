import { Collection } from '$lib/constants/collections.constants';
import { RelationCategory, RelationState } from '$lib/enums/relation';
import type { Relation } from '$lib/types/relation';
import { isNullish } from '@dfinity/utils';
import { msgCaller } from '@junobuild/functions/ic-cdk';
import {
	decodeDocData,
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

export const listRejectedFriendships = (): Relation[] => {
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
				r.state === RelationState.REJECTED &&
				r.participants.includes(callerText)
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

	const now = Date.now();
	const relation: Relation = {
		category: RelationCategory.FRIEND,
		state: RelationState.PENDING,
		participants: [sender, target],
		createdAt: now,
		updatedAt: now
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
			...doc,
			data: encodeDocData({
				...relation,
				state: RelationState.ACTIVE,
				updatedAt: Date.now()
			})
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
			...doc,
			data: encodeDocData({
				...relation,
				state: RelationState.REJECTED,
				updatedAt: Date.now()
			})
		},
		caller
	});
};

export const followUser = ({ target }: { target: PrincipalText }): void => {
	const caller = msgCaller();
	const sender = caller.toText();
	const relationId = `follow#${sender}#${target}`;

	const now = Date.now();
	const relation: Relation = {
		category: RelationCategory.FOLLOW,
		state: RelationState.ACTIVE,
		participants: [sender, target],
		createdAt: now,
		updatedAt: now
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
