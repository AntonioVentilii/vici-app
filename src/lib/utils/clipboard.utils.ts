import { notificationsStore } from '$lib/stores/notification.store';

export const copyToClipboard = async ({ value, text }: { value: string; text: string }) => {
	await navigator.clipboard.writeText(value);

	notificationsStore.add({
		title: 'Copied',
		message: `${text} copied to clipboard.`,
		type: 'success',
		duration: 2000
	});
};
