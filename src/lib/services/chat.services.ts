import { Collection } from '$lib/constants/collections.constants';
import type { ChatMessage } from '$lib/types/chat';
import type { PrincipalText } from '@dfinity/zod-schemas';
import { listDocs, setDoc } from '@junobuild/core';

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

export const getMarketMessages = async (marketId: string): Promise<ChatMessage[]> => {
	const { items } = await listDocs<ChatMessage>({
		collection: Collection.CHATS
		// In a real scenario, we'd use a filter or a range query if Juno supports it efficiently
		// For now, we fetch and filter
	});

	return items
		.map((doc) => doc.data)
		.filter((m) => m.marketId === marketId)
		.sort((a, b) => a.timestamp - b.timestamp);
};
