<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import { onAuthStateChange, type User } from '@junobuild/core';
	import { onMount, type Snippet } from 'svelte';
	import { browser } from '$app/environment';
	import { SIGNED_IN_FLAG_KEY } from '$lib/constants/app.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { reconcileIdentityScopedStorage } from '$lib/services/identity-storage.services';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import { ensureProfile, calculateAndSyncStats } from '$lib/services/profile.services';
	import { receivedReactionsStore } from '$lib/stores/activity-reactions.store';
	import { clearAffiliations } from '$lib/stores/affiliations.store';
	import { followingStore } from '$lib/stores/following.store';
	import { clearFriendRelations } from '$lib/stores/friends.store';
	import { clearLeagues } from '$lib/stores/leagues.store';
	import { clearMyMenagerieSignals } from '$lib/stores/menagerie.store';
	import { positionsStore } from '$lib/stores/positions.store';
	import { setCachedProfile } from '$lib/stores/profiles.store';
	import { clearMyReferrals } from '$lib/stores/referrals.store';
	import { tradeHistoryStore } from '$lib/stores/trade-history.store';
	import { userStore } from '$lib/stores/user.store';

	/**
	 * Write (or clear) the `SIGNED_IN_FLAG_KEY` hint that this device has an
	 * authenticated session. Read by the root gate (`src/routes/+page.svelte`)
	 * on a cold load of `/`: while the auth handshake is still unresolved, a
	 * device carrying this hint is almost certainly resuming a session, so the
	 * gate holds a branded spinner (instead of the blank brand shell) until it
	 * bounces to `/flow` via a client-side `goto`. Wrapped in try/catch for SSR
	 * / private-mode safety — a missing flag just means the gate shows the
	 * blank shell during that window instead.
	 */
	const setSignedInFlag = (signedIn: boolean): void => {
		if (!browser) {
			return;
		}

		try {
			if (signedIn) {
				localStorage.setItem(SIGNED_IN_FLAG_KEY, '1');
			} else {
				localStorage.removeItem(SIGNED_IN_FLAG_KEY);
			}
		} catch {
			// localStorage may throw in private mode or when storage is
			// disabled. Silently degrade — the no-flash hint is purely
			// an optimisation.
		}
	};

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
		clearAffiliations();
		clearLeagues();
		clearMyMenagerieSignals();
		clearMyReferrals();
		followingStore.set(undefined);
		positionsStore.set(undefined);
		tradeHistoryStore.set(undefined);
		receivedReactionsStore.set(undefined);

		// Same idea for the identity-scoped localStorage caches, except
		// those are local-authoritative (not server-backed) — see
		// `reconcileIdentityScopedStorage`.
		reconcileIdentityScopedStorage({ ownerKey: user?.owner });

		try {
			if (isNullish(user)) {
				setSignedInFlag(false);

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
				setSignedInFlag(false);

				userStore.set({
					user: undefined,
					profile: undefined,
					authBusy: false,
					profileExisted: false
				});

				return;
			}

			const { profile, existed } = await ensureProfile(user);

			setSignedInFlag(true);

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

	// No-op: the auth-timer event clears the session via the auth state
	// change above; nothing extra to do here.
	const automaticSignOut = (): void => {};
</script>

<svelte:window onjunoSignOutAuthTimer={automaticSignOut} />

{@render children()}
