import { initStorageStore } from '$lib/stores/storage.store';
import type { InboxNotification } from '$lib/types/inbox';

const INBOX_STORAGE_KEY = 'vici.inbox.v1';

const seedInbox = (): InboxNotification[] => [
	{
		id: 'n1',
		kind: 'streak',
		title: 'Streak protected',
		body: 'You kept your daily flame alive. One more call tomorrow.',
		when: '2h ago',
		unread: true
	},
	{
		id: 'n2',
		kind: 'resolve',
		title: 'Market resolved',
		body: 'Your call on “Fed cuts in June?” settled YES.',
		when: 'Yesterday',
		unread: true
	},
	{
		id: 'n3',
		kind: 'social',
		title: 'Friend activity',
		body: '@oracle_nina called NO on the same market.',
		when: 'Yesterday',
		unread: false
	},
	{
		id: 'n4',
		kind: 'level',
		title: 'Level up',
		body: 'You reached level 4. +250 session XP unlocked.',
		when: '3d ago',
		unread: false
	},
	{
		id: 'n5',
		kind: 'challenge',
		title: 'Challenge invite',
		body: 'A friend invited you to a head-to-head Flow duel.',
		when: '4d ago',
		unread: false
	},
	{
		id: 'n6',
		kind: 'market',
		title: 'Market alert',
		body: 'YES probability moved 12 pts on a market you follow.',
		when: '5d ago',
		unread: false
	}
];

const baseInboxStore = initStorageStore<InboxNotification[]>({
	key: INBOX_STORAGE_KEY,
	defaultValue: seedInbox()
});

export const inboxStore = {
	...baseInboxStore,
	update: (updater: (items: InboxNotification[]) => InboxNotification[]) => {
		baseInboxStore.update((current) => {
			const next = updater(current);
			baseInboxStore.set({ key: INBOX_STORAGE_KEY, value: next });

			return next;
		});
	}
};

export const markAllInboxRead = (): void => {
	inboxStore.update((items) => items.map((item) => ({ ...item, unread: false })));
};
