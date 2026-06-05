import { USD_DECIMALS, ZERO } from '$lib/constants/app.constants';
import { INBOX_SETTLED_READ_STORAGE_KEY, INBOX_STORAGE_KEY } from '$lib/constants/inbox.constants';
import { AppPath } from '$lib/constants/routes.constants';
import { markets } from '$lib/derived/markets.derived';
import {
	resolvedPositions,
	resolvedPositionsNotInitialized
} from '$lib/derived/resolved-positions.derived';
import { friendRequestsStore, friendsRelationsLoadedStore } from '$lib/stores/friends.store';
import { localeStore } from '$lib/stores/locale.store';
import { profilesStore } from '$lib/stores/profiles.store';
import { initStorageStore } from '$lib/stores/storage.store';
import { userStore } from '$lib/stores/user.store';
import type { ResolutionItem, ResolutionRevealData } from '$lib/types/flow';
import type { InboxNotification, InboxNotificationKind } from '$lib/types/inbox';
import type { Market } from '$lib/types/market';
import type { ResolvedPosition } from '$lib/types/position';
import type { Relation } from '$lib/types/relation';
import {
	decimalFixedValueToNumber,
	formatRelativeAgoFromNs,
	shortenWithMiddleEllipsis
} from '$lib/utils/format.utils';
import { t } from '$lib/utils/i18n.utils';
import { inferResolvedOutcomeId } from '$lib/utils/resolved-position.utils';
import { get, set as setStorage } from '$lib/utils/storage.utils';
import type { Doc } from '@junobuild/core';
import { derived, get as getStore, writable, type Readable } from 'svelte/store';

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
		body: 'You reached level 4. +250 session VXP unlocked.',
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

const loadSettledReadSet = (): Set<bigint> => {
	const raw = get<string[]>({ key: INBOX_SETTLED_READ_STORAGE_KEY });

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
		key: INBOX_SETTLED_READ_STORAGE_KEY,
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

// ── "While you were away" resolution digest ─────────────────────────────────
// The Flow entry away-digest and the Dashboard resolution banner both surface
// the calls that settled since the user last acknowledged their resolutions.
// "Unacknowledged" is the same per-event read marker the Settled inbox cards
// use (`settledReadStore`), so opening the digest and marking it seen keeps the
// banner and the bell badge in lockstep — one settlement is never counted twice
// or surfaced in one place after being cleared in the other.

/**
 * Side the user held on a settled market, mapped to the visual chip bucket.
 * Mirrors the Portfolio resolved-row inference (`inferResolvedOutcomeId`) so
 * the digest rows read identically to the history rows. Categorical losers
 * can't be disambiguated, so they fall back to the neutral `hold` bucket.
 */
const resolvedSide = ({
	resolved,
	market
}: {
	resolved: Pick<ResolvedPosition, 'outcomeId'>;
	market?: Market;
}): { label: string; sideKey: ResolutionItem['sideKey'] } => {
	const outcomeId = inferResolvedOutcomeId({ resolved, market });

	if (outcomeId === 'YES') {
		return { label: 'YES', sideKey: 'yes' };
	}

	if (outcomeId === 'NO') {
		return { label: 'NO', sideKey: 'no' };
	}

	const label = outcomeId
		? (market?.outcomes?.find((o) => o.id === outcomeId)?.title ?? outcomeId)
		: '—';

	return { label, sideKey: 'hold' };
};

/**
 * The away-digest: every settled call the user hasn't acknowledged yet,
 * aggregated into net VXP, win/loss tallies, and per-call rows. A `count` of 0
 * means there is nothing new to reveal. Per-call and net VXP are carried at
 * full precision; the digest renderers round for display (a sub-1 favourite
 * win reads "<1" rather than a broken "+0" — see `formatWholeVxpMagnitude`).
 */
export const maturedResolutions: Readable<ResolutionRevealData> = derived(
	[resolvedPositions, markets, settledReadStore, localeStore],
	([$resolved, $markets, $read, $locale]) => {
		const marketById = new Map($markets.map((m) => [m.id, m]));
		const unseen = $resolved.filter((entry) => !$read.has(entry.eventId));

		const items: ResolutionItem[] = unseen.map((entry) => {
			const market = marketById.get(entry.marketId);
			const { label, sideKey } = resolvedSide({ resolved: entry, market });
			// Full precision — the digest renderers round for display via
			// `formatWholeVxpMagnitude` (a sub-1 favourite win reads "<1", not a
			// broken "+0"). Summing the precise per-call nets also keeps the
			// digest total honest rather than dropping every sub-1 win to zero.
			const net = decimalFixedValueToNumber({
				value: entry.realizedPnlUsd,
				decimals: USD_DECIMALS
			});

			return {
				eventId: entry.eventId,
				marketId: entry.marketId,
				question: market?.title ?? t({ locale: $locale, key: 'portfolio.unknown_market' }),
				side: label,
				sideKey,
				result: entry.result,
				won: entry.result === 'won',
				net
			};
		});

		const wins = items.filter((it) => it.result === 'won').length;
		const neutrals = items.filter((it) => it.result === 'neutral').length;
		const netVxp = items.reduce((sum, it) => sum + it.net, 0);

		return {
			items,
			count: items.length,
			wins,
			losses: items.length - wins - neutrals,
			neutrals,
			netVxp
		};
	}
);

/**
 * Acknowledges every call currently in the away-digest by adding its
 * `eventId` to the persisted read set — the same marker the Settled inbox
 * cards use. Called when the user enters Flow (the entry digest settles) or
 * opens the Dashboard ResolutionReveal, so the banner and bell badge clear
 * together. Idempotent: re-running with the digest empty is a no-op.
 */
export const markResolutionsSeen = (): void => {
	const digest = getStore(maturedResolutions);

	if (digest.count === 0) {
		return;
	}

	settledReadStore.update((current) => {
		const next = new Set(current);

		for (const item of digest.items) {
			next.add(item.eventId);
		}

		persistSettledReadSet(next);

		return next;
	});
};

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

// ── New-arrival toast feed ──────────────────────────────────────────────────
// The slide-in popup (`NotifToastHost`) surfaces on a genuinely NEW inbox
// item — a real event (a freshly-settled market, an incoming friend request,
// …) that wasn't present on the previous tick.
//
// Gating strategy: user-scoped async sources (trade history / resolvedPositions,
// friend relations) are still loading at cold start. The first synchronous
// `combinedInboxStore` emission carries an incomplete snapshot — if we diffed
// from that we'd fire arrival toasts for every pre-existing unread item.
// Instead we delay the diff until BOTH async sources report ready:
//   • `resolvedPositionsNotInitialized` flips false → trade history has loaded
//   • `friendsRelationsLoadedStore` flips true → friend relations have loaded
// Until then every emission is treated as baseline-only (ids are accumulated,
// no toast is fired). The seed store (localStorage) is synchronous — its
// content is included in the baseline naturally.
//
// On auth transitions `Authn.svelte` resets `tradeHistoryStore` to `undefined`
// and calls `clearFriendRelations()`, which reverts both signals to
// "not loaded". That drives `sourcesHydrated` back to `false`, so the next
// sign-in's cold-start data is baseline-only too — a different principal's
// existing unreads never replay as arrival toasts.

export interface InboxToast {
	id: string;
	kind: InboxNotificationKind;
	title: string;
	body: string;
	href?: string;
}

const inboxToastStore = writable<InboxToast | undefined>(undefined);

/**
 * The most recent newly-arrived unread inbox item, or `undefined` once
 * dismissed / consumed. `NotifToastHost` subscribes to this and animates the
 * popup in; calling {@link clearInboxToast} retracts it.
 */
export const latestInboxToast: Readable<InboxToast | undefined> = inboxToastStore;

export const clearInboxToast = (): void => {
	inboxToastStore.set(undefined);
};

/**
 * True once both async user-scoped inbox sources have completed their initial
 * load. We use this to gate the toast diff so cold-start data never fires
 * arrival toasts.
 *
 * - `resolvedPositionsNotInitialized` starts `true`, flips `false` once the
 *   clearing-canister trade history fetch completes (even if empty).
 * - `friendsRelationsLoadedStore` starts `false`, flips `true` once the
 *   first `refreshFriendRelations()` call completes.
 */
const sourcesHydrated: Readable<boolean> = derived(
	[resolvedPositionsNotInitialized, friendsRelationsLoadedStore],
	([$notInit, $friendsLoaded]) => !$notInit && $friendsLoaded
);

let seenInboxIds: Set<string> | undefined;

derived([combinedInboxStore, sourcesHydrated], ([$items, $hydrated]) => ({
	items: $items,
	hydrated: $hydrated
})).subscribe(({ items, hydrated }) => {
	if (!hydrated) {
		// Sources still loading — accumulate ids as baseline without diffing.
		seenInboxIds = new Set(items.map((item) => item.id));

		return;
	}

	if (seenInboxIds === undefined) {
		// Hydration just completed but no baseline recorded yet (edge case:
		// subscribe fired with hydrated=true before any non-hydrated tick).
		seenInboxIds = new Set(items.map((item) => item.id));

		return;
	}

	const next = items.find((item) => item.unread && !seenInboxIds?.has(item.id));

	seenInboxIds = new Set(items.map((item) => item.id));

	if (next === undefined) {
		return;
	}

	inboxToastStore.set({
		id: next.id,
		kind: next.kind,
		title: next.title,
		body: next.body,
		href: next.href
	});
});

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
