import { Collection } from '$lib/constants/collections.constants';
import type { ChatMessage } from '$lib/types/chat';
import { listDocs, setDoc } from '@junobuild/core';
import type { PrincipalText } from '@junobuild/schema';

/**
 * Persists a market chat message with a generated document key.
 */
export const sendMessage = async ({
	marketId,
	sender,
	content
}: {
	marketId: string;
	sender: PrincipalText;
	content: string;
}): Promise<void> => {
	const timestamp = Date.now();

	const message: ChatMessage = {
		marketId,
		sender,
		content,
		timestamp
	};

	const messageKey = `${marketId}#${timestamp}#${sender.slice(0, 5)}`;

	await setDoc({
		collection: Collection.CHATS,
		doc: {
			key: messageKey,
			data: message
		}
	});
};

/**
 * Lists chat messages for a market, oldest first.
 */
export const getMarketMessages = async (marketId: string): Promise<ChatMessage[]> => {
	const { items } = await listDocs<ChatMessage>({
		collection: Collection.CHATS
	});

	return items
		.map(({ data }) => data)
		.filter((m) => m.marketId === marketId)
		.sort((a, b) => a.timestamp - b.timestamp);
};
