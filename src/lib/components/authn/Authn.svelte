<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import { onAuthStateChange, type User } from '@junobuild/core';
	import { onMount, type Snippet } from 'svelte';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import { ensureProfile, calculateAndSyncStats } from '$lib/services/profile.services';
	import { followingStore } from '$lib/stores/following.store';
	import { clearFriendRelations } from '$lib/stores/friends.store';
	import { positionsStore } from '$lib/stores/positions.store';
	import { setCachedProfile } from '$lib/stores/profiles.store';
	import { tradeHistoryStore } from '$lib/stores/trade-history.store';
	import { userStore } from '$lib/stores/user.store';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();

	const updateUserStore = async (user: User | null) => {
		userStore.update((data) => ({ ...data, authBusy: true }));

		// Drop the previous principal's user-scoped caches on every auth
		// transition (sign-out, user switch, initial bootstrap). The next
		// `<Loaders />` cycle repopulates them for the new identity; this
		// just prevents user A's friends / positions / trade history from
		// briefly bleeding into user B's UI. Public caches (markets,
		// leaderboard, categories) intentionally stay populated.
		clearFriendRelations();
		followingStore.set(undefined);
		positionsStore.set(undefined);
		tradeHistoryStore.set(undefined);

		try {
			if (isNullish(user)) {
				userStore.set({
					user: undefined,
					profile: undefined,
					authBusy: false,
					profileExisted: false
				});

				return;
			}

			const { key: userText } = user;

			if (isNullish(userText)) {
				userStore.set({
					user: undefined,
					profile: undefined,
					authBusy: false,
					profileExisted: false
				});

				return;
			}

			const { profile, existed } = await ensureProfile(user);

			userStore.set({ user, profile, authBusy: false, profileExisted: existed });

			try {
				const identity = await safeGetIdentityOnce();

				await calculateAndSyncStats({ identity, domain: $balanceDomain });
			} catch (e: unknown) {
				console.error('Failed to sync stats on login', e);
			}
		} finally {
			userStore.update((data) => ({ ...data, authBusy: false }));
		}
	};

	onMount(() => {
		const unsubscribe = onAuthStateChange(updateUserStore);

		return () => {
			unsubscribe();
		};
	});

	// Mirror the current user's profile into `profilesStore` so every
	// surface that resolves a counterpart's display name via that cache
	// (activity feed, market recent trades, market discussion, …) renders
	// the viewer's own latest nickname/avatar instead of whatever the
	// satellite-side public read most recently returned. Without this,
	// editing the nickname in this session leaves a stale entry in the
	// cache until the next page reload.
	$effect(() => {
		const { user, profile } = $userStore;

		if (!user?.owner || !profile) {
			return;
		}

		setCachedProfile({ principal: user.owner, profile });
	});

	// eslint-disable-next-line no-console
	const automaticSignOut = () => console.log('Automatically signed out because session expired');
</script>

<svelte:window onjunoSignOutAuthTimer={automaticSignOut} />

{@render children()}
