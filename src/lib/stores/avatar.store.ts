import { upsertProfile } from '$lib/services/profile.services';
import { userStore } from '$lib/stores/user.store';
import { parseParts, serializeParts, type ViciAvatarParts } from '$lib/utils/vici-avatar.utils';
import { derived, get, type Readable } from 'svelte/store';

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
	myAvatarPartsRaw,
	(raw) => parseParts(raw)
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

	userStore.update((curr) => ({ ...curr, profile: updated }));

	try {
		await upsertProfile({ key: owner, data: updated });
	} catch (err: unknown) {
		userStore.update((curr) => ({ ...curr, profile: previous }));

		throw err;
	}
};
