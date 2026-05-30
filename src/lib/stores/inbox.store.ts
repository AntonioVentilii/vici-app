import { USD_DECIMALS, ZERO } from '$lib/constants/app.constants';
import { AppPath } from '$lib/constants/routes.constants';
import { markets } from '$lib/derived/markets.derived';
import { resolvedPositions } from '$lib/derived/resolved-positions.derived';
import { friendRequestsStore } from '$lib/stores/friends.store';
import { localeStore } from '$lib/stores/locale.store';
import { profilesStore } from '$lib/stores/profiles.store';
import { initStorageStore } from '$lib/stores/storage.store';
import { userStore } from '$lib/stores/user.store';
import type { InboxNotification } from '$lib/types/inbox';
import type { Relation } from '$lib/types/relation';
import {
	decimalFixedValueToNumber,
	formatRelativeAgoFromNs,
	shortenWithMiddleEllipsis
} from '$lib/utils/format.utils';
import { t } from '$lib/utils/i18n.utils';
import { get, set as setStorage } from '$lib/utils/storage.utils';
import type { Doc } from '@junobuild/core';
import { derived, get as getStore, writable, type Readable } from 'svelte/store';

const INBOX_STORAGE_KEY = 'vici.inbox.v1';

// The seed used to include a mock `resolve` card; that's now sourced from
// real Settled events via `settledInboxStore`, so it's been removed here.
// The remaining placeholders are kept because their backing systems
// (streaks, level XP, follow alerts) aren't wired to live data yet — once
// they are, drop them the same way.
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

/**
 * Marks the persisted seed/history inbox items as read. The combined
 * `markAllInboxRead` further below also clears the per-event Settled
 * read-state — this internal helper just handles the seed layer.
 */
const markAllSeedInboxRead = (): void => {
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
				// Friends now only live inside the Arena tab strip (Tier C-27).
				// The Arena shell restores the last-opened tab from
				// `vici.arena-tab`, which the FriendsTab UI keeps on
				// `'friends'` after the user accepts/rejects a request.
				href: AppPath.Arena
			};
		});
	}
);

// ── Settled-event notifications ─────────────────────────────────────────────

const SETTLED_READ_STORAGE_KEY = 'vici.inbox.resolves.read.v1';

const loadSettledReadSet = (): Set<bigint> => {
	const raw = get<string[]>({ key: SETTLED_READ_STORAGE_KEY });

	if (raw === undefined) {
		return new Set();
	}

	try {
		return new Set(raw.map((id) => BigInt(id)));
	} catch {
		return new Set();
	}
};

const persistSettledReadSet = (set: Set<bigint>): void => {
	setStorage({
		key: SETTLED_READ_STORAGE_KEY,
		value: Array.from(set, (id) => id.toString())
	});
};

/**
 * Per-event read state for Settled-event inbox cards, keyed by `event_id`.
 * Persisted to localStorage so the read marker survives reloads. Events
 * themselves come from the clearing canister, so we only need to remember
 * which ones the user has already acknowledged.
 */
const settledReadStore = writable<Set<bigint>>(loadSettledReadSet());

/**
 * Maps a resolved-position record to its inbox card. Body copy picks the
 * won/lost/neutral variant from the realized PnL sign, and the absolute
 * amount is formatted in clearing-USD units so it can flow into the
 * already-existing "X.YZ USD" presentation downstream surfaces use.
 */
const settledInboxStore: Readable<InboxNotification[]> = derived(
	[resolvedPositions, markets, settledReadStore, localeStore],
	([$resolved, $markets, $read, $locale]) => {
		const marketById = new Map($markets.map((m) => [m.id, m]));

		return $resolved.map((entry): InboxNotification => {
			const market = marketById.get(entry.marketId);

			const variant: 'won' | 'lost' | 'neutral' = entry.result;
			const titleKey =
				variant === 'won'
					? 'inbox.resolve.title.won'
					: variant === 'lost'
						? 'inbox.resolve.title.lost'
						: 'inbox.resolve.title.neutral';
			const bodyKey =
				variant === 'won'
					? 'inbox.resolve.body.won'
					: variant === 'lost'
						? 'inbox.resolve.body.lost'
						: 'inbox.resolve.body.neutral';

			// Body shows the absolute amount; the sign is conveyed by the
			// won / lost copy itself.
			const absPnl = entry.realizedPnlUsd < ZERO ? -entry.realizedPnlUsd : entry.realizedPnlUsd;
			const amount = decimalFixedValueToNumber({ value: absPnl, decimals: USD_DECIMALS }).toFixed(
				2
			);

			const marketTitle = market?.title ?? t({ locale: $locale, key: 'portfolio.unknown_market' });

			return {
				id: `settled-${entry.eventId.toString()}`,
				kind: 'resolve',
				title: t({ locale: $locale, key: titleKey }),
				body: t({
					locale: $locale,
					key: bodyKey,
					params: { amount, market: marketTitle }
				}),
				when: formatRelativeAgoFromNs({ timestampNs: entry.timestampNs, locale: $locale }),
				unread: !$read.has(entry.eventId),
				href: `${AppPath.Markets}/${entry.marketId}`
			};
		});
	}
);

/**
 * The inbox surface (Notifications page, future bell badge) reads from
 * this combined view. Order: live actionable items (friend requests),
 * then real settled-event notifications, then the persisted local seed.
 * Settled cards sit above the seeds so a freshly-resolved market lands
 * at the top of the user's view.
 */
export const combinedInboxStore: Readable<InboxNotification[]> = derived(
	[friendRequestInboxStore, settledInboxStore, inboxStore],
	([$requests, $settled, $inbox]) => [...$requests, ...$settled, ...$inbox]
);

export const combinedInboxUnreadCount: Readable<number> = derived(
	combinedInboxStore,
	($items) => $items.filter((item) => item.unread).length
);

/**
 * Marks every currently-visible settled-event card as read by adding
 * its `event_id` to the persisted per-event read set. Paired with
 * `markAllSeedInboxRead` (which clears the seed/history layer) — see
 * the `markAllInboxRead` public entry point further below for the
 * combined behavior.
 */
const markAllSettledRead = (): void => {
	const visible = getStore(settledInboxStore);

	if (visible.length === 0) {
		return;
	}

	// `settled-<eventId>` — strip the prefix to recover the bigint id.
	const SETTLED_PREFIX = 'settled-';
	const idsToMark = visible.flatMap((item) => {
		if (!item.id.startsWith(SETTLED_PREFIX)) {
			return [];
		}

		try {
			return [BigInt(item.id.slice(SETTLED_PREFIX.length))];
		} catch {
			// Defensive — non-numeric id shouldn't reach here.
			return [];
		}
	});

	if (idsToMark.length === 0) {
		return;
	}

	settledReadStore.update((current) => {
		const next = new Set(current);

		for (const id of idsToMark) {
			next.add(id);
		}

		persistSettledReadSet(next);

		return next;
	});
};

/**
 * Public "mark all read" entry point. Clears both the seed-store layer
 * and the per-event Settled read-state. Callers (NotificationsPage,
 * future bell action) should use this — never the layer-specific
 * helpers directly.
 */
export const markAllInboxRead = (): void => {
	markAllSeedInboxRead();
	markAllSettledRead();
};
