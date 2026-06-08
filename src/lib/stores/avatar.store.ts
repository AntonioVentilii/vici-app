import { upsertProfile } from '$lib/services/profile.services';
import { userStore } from '$lib/stores/user.store';
import { parseParts, serializeParts, type ViciAvatarParts } from '$lib/utils/vici-avatar.utils';
import { derived, get, writable, type Readable } from 'svelte/store';

/**
 * Session-durable in-memory cache of the last avatar parts the user committed
 * from the editor. The profile doc is the cross-session persistence layer, but
 * its write can fail (offline, satellite rejection, sandboxed/IC asset host
 * with no reachable backend). Without a fallback, a failed persist would roll
 * the optimistic `userStore` write back and the user's freshly-picked face
 * would silently revert. This cache holds the committed picks for the rest of
 * the session so an edit never vanishes mid-session even when the persist
 * never lands. It is intentionally module-scoped (lives for the page session,
 * cleared on reload) and never written to disk.
 */
const sessionAvatarParts = writable<ViciAvatarParts | undefined>(undefined);

/**
 * The logged-in user's saved avatar parts, derived from the live profile in
 * {@link userStore}. Every "you" surface (profile identity card, nav, the
 * leaderboard "You" row) reads this so a save re-renders them all at once —
 * the optimistic `userStore` write in {@link saveMyAvatarParts} flows
 * straight back out here. `undefined` means the user has never saved picks
 * (the surface falls back to a deterministic principal-seeded face).
 *
 * Narrowed to the raw serialized string first so the `JSON.parse` in
 * {@link parseParts} only re-runs when that string actually changes, not on
 * every unrelated `userStore` tick (`authBusy`, balance, …).
 */
const myAvatarPartsRaw: Readable<string | undefined> = derived(
	userStore,
	({ profile }) => profile?.avatarParts
);

export const myAvatarParts: Readable<ViciAvatarParts | undefined> = derived(
	[myAvatarPartsRaw, sessionAvatarParts],
	([raw, session]) => parseParts(raw) ?? session
);

/**
 * Persists the logged-in user's avatar parts. Optimistically writes the
 * serialized picks into {@link userStore} first — so every surface reading
 * {@link myAvatarParts} re-renders immediately — then commits to the
 * profile. Rolls the optimistic update back on failure.
 */
export const saveMyAvatarParts = async (parts: ViciAvatarParts): Promise<void> => {
	const { profile } = get(userStore);

	if (!profile) {
		return;
	}

	const { owner } = profile;
	const serialized = serializeParts(parts);
	const previous = profile;
	const updated = { ...profile, avatarParts: serialized };

	// Seed the session-durable cache first: even if the optimistic profile
	// write is rolled back on a persist failure below, `myAvatarParts` keeps
	// resolving to these picks for the rest of the session, so the user's edit
	// never silently reverts.
	sessionAvatarParts.set(parts);

	userStore.update((curr) => ({ ...curr, profile: updated }));

	// Notify avatar-derived surfaces that render outside the reactive
	// `myAvatarParts` path (e.g. the full-bleed profile hero, which recolours
	// its gradient from the picked backdrop) so they re-sync the instant a save
	// commits rather than waiting for an incidental re-render. SSR-safe guard.
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent('avatarchange', { detail: parts }));
	}

	try {
		await upsertProfile({ key: owner, data: updated });
	} catch (err: unknown) {
		userStore.update((curr) => ({ ...curr, profile: previous }));

		throw err;
	}
};
