import { Collection } from '$lib/constants/collections.constants';
import type { Comment } from '$lib/types/comment';
import { deleteDoc, getDoc, listDocs, setDoc } from '@junobuild/core';

export const getMarketComments = async (marketId: string): Promise<Comment[]> => {
	const { items } = await listDocs<Comment>({
		collection: Collection.COMMENTS
	});

	return items
		.map(({ key, data }) => ({ ...data, key }))
		.filter((c) => c.marketId === marketId)
		.sort((a, b) => a.timestamp - b.timestamp);
};

export const addComment = async (
	comment: Omit<Comment, 'timestamp' | 'key' | 'upvotes' | 'downvotes'>
): Promise<void> => {
	const timestamp = Date.now();

	const key = `${comment.marketId}#${timestamp}#${comment.user.slice(0, 5)}`;

	await setDoc({
		collection: Collection.COMMENTS,
		doc: {
			key,
			data: {
				...comment,
				timestamp,
				upvotes: [],
				downvotes: []
			}
		}
	});
};

export const upvoteComment = async ({
	commentKey,
	userPrincipal
}: {
	commentKey: string;
	userPrincipal: string;
}): Promise<void> => {
	const doc = await getDoc<Comment>({
		collection: Collection.COMMENTS,
		key: commentKey
	});

	if (!doc) {
		return;
	}

	const { data } = doc;
	let upvotes = data.upvotes || [];
	let downvotes = data.downvotes || [];

	if (upvotes.includes(userPrincipal)) {
		upvotes = upvotes.filter((u) => u !== userPrincipal);
	} else {
		upvotes.push(userPrincipal);
		downvotes = downvotes.filter((u) => u !== userPrincipal);
	}

	await setDoc({
		collection: Collection.COMMENTS,
		doc: {
			...doc,
			data: {
				...data,
				upvotes,
				downvotes
			}
		}
	});
};

export const downvoteComment = async ({
	commentKey,
	userPrincipal
}: {
	commentKey: string;
	userPrincipal: string;
}): Promise<void> => {
	const doc = await getDoc<Comment>({
		collection: Collection.COMMENTS,
		key: commentKey
	});

	if (!doc) {
		return;
	}

	const { data } = doc;
	let upvotes = data.upvotes || [];
	let downvotes = data.downvotes || [];

	if (downvotes.includes(userPrincipal)) {
		downvotes = downvotes.filter((u) => u !== userPrincipal);
	} else {
		downvotes.push(userPrincipal);
		upvotes = upvotes.filter((u) => u !== userPrincipal);
	}

	await setDoc({
		collection: Collection.COMMENTS,
		doc: {
			...doc,
			data: {
				...data,
				upvotes,
				downvotes
			}
		}
	});
};

export const deleteComment = async (commentKey: string): Promise<void> => {
	const doc = await getDoc<Comment>({
		collection: Collection.COMMENTS,
		key: commentKey
	});

	if (!doc) {
		return;
	}

	await deleteDoc({
		collection: Collection.COMMENTS,
		doc
	});
};
