import { AppPath } from '$lib/constants/routes.constants';
import { friendRequestsStore } from '$lib/stores/friends.store';
import { localeStore } from '$lib/stores/locale.store';
import { profilesStore } from '$lib/stores/profiles.store';
import { initStorageStore } from '$lib/stores/storage.store';
import { userStore } from '$lib/stores/user.store';
import type { InboxNotification } from '$lib/types/inbox';
import type { Relation } from '$lib/types/relation';
import { shortenWithMiddleEllipsis } from '$lib/utils/format.utils';
import { t } from '$lib/utils/i18n.utils';
import type { Doc } from '@junobuild/core';
import { derived, type Readable } from 'svelte/store';

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

/**
 * Turns the viewer's pending friend requests into inbox cards. They are
 * synthetic (not persisted in localStorage) and remain `unread` until the
 * underlying request is accepted or rejected — at which point they drop
 * out of `friendRequestsStore` and disappear from the inbox automatically.
 */
const friendRequestInboxStore: Readable<InboxNotification[]> = derived(
	[friendRequestsStore, profilesStore, userStore, localeStore],
	([$requests, $profiles, $user, $locale]) => {
		const viewer = $user.user?.owner;

		return $requests.map((doc: Doc<Relation>) => {
			const otherPrincipal =
				doc.data.participants.find((p) => p !== viewer) ?? doc.data.participants[0];
			const profile = $profiles.get(otherPrincipal);
			const displayName = profile?.nickname?.trim()
				? `@${profile.nickname.trim()}`
				: shortenWithMiddleEllipsis({ text: otherPrincipal, splitLength: 6 });

			return {
				id: `friend-request-${doc.key}`,
				kind: 'friend_request' as const,
				title: t({ locale: $locale, key: 'inbox.friend_request.title' }),
				body: t({
					locale: $locale,
					key: 'inbox.friend_request.body',
					params: { user: displayName }
				}),
				when: t({ locale: $locale, key: 'inbox.pending' }),
				unread: true,
				// Friends now only live inside the Social tab strip (Tier C-27).
				// The Social shell restores the last-opened tab from
				// `vici.social-tab`, which the FriendsTab UI keeps on
				// `'friends'` after the user accepts/rejects a request.
				href: AppPath.Social
			};
		});
	}
);

/**
 * The inbox surface (Notifications page, future bell badge) reads from
 * this combined view: live action items (friend requests) first, then
 * the persisted seed/history below. Friend requests stay above the fold
 * because they're actionable; seeds remain for context.
 */
export const combinedInboxStore: Readable<InboxNotification[]> = derived(
	[friendRequestInboxStore, inboxStore],
	([$requests, $inbox]) => [...$requests, ...$inbox]
);

export const combinedInboxUnreadCount: Readable<number> = derived(
	combinedInboxStore,
	($items) => $items.filter((item) => item.unread).length
);
