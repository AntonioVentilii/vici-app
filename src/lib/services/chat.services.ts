import { Collection } from '$lib/constants/collections.constants';
import type { ChatMessage } from '$lib/types/chat';
import type { PrincipalText } from '@dfinity/zod-schemas';
import { listDocs, setDoc } from '@junobuild/core';

/** Persists a market chat message with a generated document key. */
export const sendMessage = async ({
	marketId,
	sender,
	content
}: {
	marketId: string;
	sender: PrincipalText;
	content: string;
}): Promise<void> => {
	const message: ChatMessage = {
		marketId,
		sender,
		content,
		timestamp: Date.now()
	};

	const messageKey = `${marketId}#${Date.now()}#${sender.slice(0, 5)}`;

	await setDoc({
		collection: Collection.CHATS,
		doc: {
			key: messageKey,
			data: message
		}
	});
};

/** Lists chat messages for a market, oldest first. */
export const getMarketMessages = async (marketId: string): Promise<ChatMessage[]> => {
	const { items } = await listDocs<ChatMessage>({
		collection: Collection.CHATS
	});

	return items
		.map(({ data }) => data)
		.filter((m) => m.marketId === marketId)
		.sort((a, b) => a.timestamp - b.timestamp);
};
