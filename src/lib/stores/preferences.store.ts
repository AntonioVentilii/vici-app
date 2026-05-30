import { browser } from '$app/environment';
import { MARKET_TAGS } from '$lib/constants/market-tags.constants';
import { PREFERENCES_STORAGE_KEY } from '$lib/constants/settings.constants';
import { authPrincipal } from '$lib/derived/user.derived';
import { upsertProfile } from '$lib/services/profile.services';
import { userStore } from '$lib/stores/user.store';
import type { UserPreferences } from '$lib/types/preferences';
import type { UserProfile } from '$lib/types/profile';
import { isNullish, nonNullish } from '@dfinity/utils';
import { get, writable } from 'svelte/store';

/**
 * Cross-device user preferences store.
 *
 * Source of truth is `profile.preferences` on the user's profile doc.
 * The store mirrors that field locally so components can read with
 * `$preferencesStore.foo` and write with `preferencesStore.update(fn)`
 * without each consumer learning the upsertProfile dance.
 *
 * Write path: every `update`/`set` optimistically updates the local
 * value, then fires `upsertProfile` in the background. Failures are
 * logged; the local optimistic state stays in place (the next profile
 * load will reconcile if the server-side write actually dropped).
 *
 * Migration: on the *first* hydrate per session, any legacy payload
 * still sitting under `localStorage[PREFERENCES_STORAGE_KEY]` is
 * merged into the profile (one-time push via `upsertProfile`) and then
 * the localStorage entry is cleared. Subsequent sessions read straight
 * from the profile.
 */

export const DEFAULT_PREFERENCES: UserPreferences = {
	defaultAmount: { flow: '0', manual: '0' },
	notify: {
		streakReminder: true,
		marketAlerts: true,
		friendActivity: false,
		weeklyDigest: true
	},
	flowSessionLength: 10,
	hapticsEnabled: true,
	callsPublic: true,
	flowTags: [...MARKET_TAGS],
	worldCupMode: false,
	savedMarketIds: [],
	favoriteParticipantId: '',
	favoriteSide: '',
	onboardingCompleted: false
};

/**
 * Loose shape the hydrator accepts. The wire schema infers
 * `flowSessionLength: number` (not the literal union), so we coerce
 * defensively on read instead of forcing every caller to narrow.
 */
interface PartialPrefsInput {
	defaultAmount?: { flow?: string; manual?: string };
	notify?: Partial<UserPreferences['notify']>;
	flowSessionLength?: number;
	hapticsEnabled?: boolean;
	callsPublic?: boolean;
	flowTags?: string[];
	worldCupMode?: boolean;
	savedMarketIds?: string[];
	favoriteParticipantId?: string;
	favoriteSide?: string;
	onboardingCompleted?: boolean;
}

const coerceFlowSessionLength = (
	value: number | undefined
): UserPreferences['flowSessionLength'] => {
	if (value === 5 || value === 10 || value === 20) {
		return value;
	}

	return DEFAULT_PREFERENCES.flowSessionLength;
};

/**
 * Normalise a partial / legacy / undefined preferences blob into the
 * full shape. Empty `flowTags` is mapped to all market tags (legacy
 * "all enabled" semantic).
 */
const hydrateShape = (partial: PartialPrefsInput | undefined): UserPreferences => ({
	defaultAmount: {
		flow: partial?.defaultAmount?.flow ?? DEFAULT_PREFERENCES.defaultAmount.flow,
		manual: partial?.defaultAmount?.manual ?? DEFAULT_PREFERENCES.defaultAmount.manual
	},
	notify: {
		...DEFAULT_PREFERENCES.notify,
		...(partial?.notify ?? {})
	},
	flowSessionLength: coerceFlowSessionLength(partial?.flowSessionLength),
	hapticsEnabled: partial?.hapticsEnabled ?? DEFAULT_PREFERENCES.hapticsEnabled,
	callsPublic: partial?.callsPublic ?? DEFAULT_PREFERENCES.callsPublic,
	flowTags:
		Array.isArray(partial?.flowTags) && partial.flowTags.length > 0
			? partial.flowTags
			: [...MARKET_TAGS],
	worldCupMode: partial?.worldCupMode ?? DEFAULT_PREFERENCES.worldCupMode,
	savedMarketIds: Array.isArray(partial?.savedMarketIds) ? partial.savedMarketIds : [],
	favoriteParticipantId:
		partial?.favoriteParticipantId ?? DEFAULT_PREFERENCES.favoriteParticipantId,
	favoriteSide:
		partial?.favoriteSide === 'YES' || partial?.favoriteSide === 'NO' ? partial.favoriteSide : '',
	onboardingCompleted: partial?.onboardingCompleted ?? DEFAULT_PREFERENCES.onboardingCompleted
});

/**
 * Read the legacy localStorage payload (if any). Returns `undefined`
 * when nothing is stored or the blob is malformed. After a successful
 * migration the caller is expected to clear the entry — this read is
 * idempotent and the second call returns `undefined`.
 */
const readLegacyLocalStorage = (): Partial<UserPreferences> | undefined => {
	if (!browser) {
		return;
	}

	try {
		const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);

		if (raw === null || raw.length === 0) {
			return;
		}

		const parsed: unknown = JSON.parse(raw);

		if (typeof parsed === 'object' && parsed !== null) {
			return parsed;
		}
	} catch {
		// Corrupt payload — ignore and let defaults take over.
	}
};

const clearLegacyLocalStorage = () => {
	if (!browser) {
		return;
	}

	try {
		localStorage.removeItem(PREFERENCES_STORAGE_KEY);
	} catch {
		// Storage may be unavailable; nothing to do.
	}
};

// Local writable store — components subscribe to this. The actual
// source of truth is `userStore.profile.preferences`; this store
// mirrors it for synchronous reads + write-through semantics.
const internal = writable<UserPreferences>({ ...DEFAULT_PREFERENCES });

let legacyMigrationAttempted = false;

/**
 * Push `next` to the profile via `upsertProfile`. Fire-and-forget
 * with a console.error fallback. Optimistic local updates have
 * already happened; this is purely the persistence side.
 */
const persistToProfile = (next: UserPreferences): void => {
	if (!browser) {
		return;
	}

	const { profile } = get(userStore);
	const principal = get(authPrincipal);

	if (isNullish(profile) || isNullish(principal)) {
		// Profile not loaded yet — the write will get picked up on
		// hydrate when the migration path runs.
		return;
	}

	const merged: UserProfile = {
		...profile,
		preferences: next
	};

	// Sync the in-memory userStore optimistically so a re-subscribe
	// doesn't immediately re-hydrate the local store with the old
	// preferences value.
	userStore.update((data) => ({ ...data, profile: merged }));

	void upsertProfile({ key: principal, data: merged }).catch((err) => {
		console.error('preferencesStore: failed to persist to profile', err);
	});
};

/**
 * Subscribe to the userStore so the local mirror tracks the canonical
 * `profile.preferences`. Runs only in the browser (SSR has no
 * userStore lifecycle).
 */
if (browser) {
	userStore.subscribe((data) => {
		const { profile } = data;

		if (isNullish(profile)) {
			// User signed out — reset to defaults so the next sign-in
			// doesn't leak the previous user's settings.
			internal.set({ ...DEFAULT_PREFERENCES });
			legacyMigrationAttempted = false;

			return;
		}

		const fromProfile = hydrateShape(profile.preferences);

		// One-time legacy migration: if the profile has the default
		// payload and localStorage has something stored, merge the
		// stored values into the profile and clear the legacy key.
		if (!legacyMigrationAttempted) {
			legacyMigrationAttempted = true;
			const legacy = readLegacyLocalStorage();

			if (nonNullish(legacy)) {
				const migrated = hydrateShape({ ...fromProfile, ...legacy });
				internal.set(migrated);
				persistToProfile(migrated);
				clearLegacyLocalStorage();

				return;
			}
		}

		internal.set(fromProfile);
	});
}

/**
 * The public preferences store. Reading returns the hydrated
 * `UserPreferences`. Writing updates the local mirror optimistically
 * and queues an `upsertProfile`.
 *
 * `persistToProfile` is called *after* `internal.set` returns so we
 * don't re-enter the subscriber chain while the local store is
 * mid-write. The userStore subscriber will fire once the
 * persistToProfile-driven userStore.update lands, but by then the
 * local internal store is already at the target value — the
 * subscriber's `internal.set(fromProfile)` is a no-op write of the
 * same payload.
 */
export const preferencesStore = {
	subscribe: internal.subscribe,
	set: (next: UserPreferences) => {
		const hydrated = hydrateShape(next);
		internal.set(hydrated);
		persistToProfile(hydrated);
	},
	update: (updater: (current: UserPreferences) => UserPreferences) => {
		const current = get(internal);
		const next = hydrateShape(updater(current));
		internal.set(next);
		persistToProfile(next);
	}
};

/**
 * Derived view of the current `flowSessionLength` ceiling, so callers
 * don't have to keep destructuring the store. Pure helper retained
 * for back-compat with the previous module shape.
 */
export const flowSessionMaxBets = (prefs: UserPreferences): number => prefs.flowSessionLength;

/**
 * Add or remove a market id from the saved-markets list. The store
 * write path round-trips through the profile, so the heart toggle
 * persists across devices.
 */
export const toggleSavedMarket = ({ marketId }: { marketId: string }): void => {
	preferencesStore.update((current) => {
		const ids = current.savedMarketIds;
		const next = ids.includes(marketId) ? ids.filter((id) => id !== marketId) : [...ids, marketId];

		return { ...current, savedMarketIds: next };
	});
};

/** Pure helper: is this market id in the saved list? */
export const isMarketSaved = ({
	marketId,
	prefs
}: {
	marketId: string;
	prefs: UserPreferences;
}): boolean => prefs.savedMarketIds.includes(marketId);
