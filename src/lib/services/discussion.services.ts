import { Collection } from '$lib/constants/collections.constants';
import type { PrincipalText } from '@dfinity/zod-schemas';
import { deleteDoc, listDocs, setDoc } from '@junobuild/core';

export interface Comment {
	marketId: string;
	user: PrincipalText;
	content: string;
	timestamp: number;
	parentKey?: string; // For simple threading
}

export const discussionService = {
	getMarketComments: async (marketId: string): Promise<Comment[]> => {
		const { items } = await listDocs<Comment>({
			collection: Collection.COMMENTS
		});

		return items
			.map((doc) => ({ ...doc.data, key: doc.key }))
			.filter((c) => c.marketId === marketId)
			.sort((a, b) => a.timestamp - b.timestamp);
	},

	addComment: async (comment: Omit<Comment, 'timestamp'>): Promise<void> => {
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
	},

	deleteComment: async (key: string): Promise<void> => {
		await deleteDoc({
			collection: Collection.COMMENTS,
			doc: {
				key
			}
		} as any);
	}
};
