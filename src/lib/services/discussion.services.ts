import { Collection } from '$lib/constants/collections.constants';
import type { Comment } from '$lib/types/comment';
import { listDocs, setDoc } from '@junobuild/core';

export const getMarketComments = async (marketId: string): Promise<Comment[]> => {
	const { items } = await listDocs<Comment>({
		collection: Collection.COMMENTS
	});

	return items
		.map(({ data }) => data)
		.filter((c) => c.marketId === marketId)
		.sort((a, b) => a.timestamp - b.timestamp);
};

export const addComment = async (comment: Omit<Comment, 'timestamp'>): Promise<void> => {
	const timestamp = Date.now();

	const key = `${comment.marketId}#${timestamp}#${comment.user.slice(0, 5)}`;

	await setDoc({
		collection: Collection.COMMENTS,
		doc: {
			key,
			data: {
				...comment,
				timestamp
			}
		}
	});
};
