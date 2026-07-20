<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import { onAuthStateChange, type User } from '@junobuild/core';
	import { onMount, type Snippet } from 'svelte';
	import { browser } from '$app/environment';
	import { SIGNED_IN_FLAG_KEY } from '$lib/constants/app.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { reconcileIdentityScopedStorage } from '$lib/services/identity-storage.services';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import type * as ProfileServices from '$lib/services/profile.services';
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

	/**
	 * Ask the browser to keep this origin's storage persistent. The Internet
	 * Identity delegation lives in IndexedDB (`auth-client-db`); on iOS WebKit,
	 * script-writable storage is evicted after ~7 days of no interaction (ITP),
	 * which lands on the same horizon as the delegation TTL and silently logs
	 * the user out. A granted persist() request exempts the delegation store
	 * from that eviction. Idempotent and a no-op once persisted, so requesting
	 * once per established session is fine. Fire-and-forget: never block or
	 * throw on the auth path, and skip when the API is unavailable.
	 */
	const requestPersistentStorage = (): void => {
		if (
			!browser ||
			typeof navigator.storage?.persist !== 'function' ||
			typeof navigator.storage?.persisted !== 'function'
		) {
			return;
		}

		void (async () => {
			try {
				await navigator.storage.persist();
			} catch (e: unknown) {
				console.warn('Persistent storage request failed', e);
			}
		})();
	};

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();

	// Loaded on demand: `profile.services` pulls the satellite API + zod
	// cluster, and a static import here would put it in the boot graph of
	// every route — including the pre-auth surfaces (signup, invite
	// landings) where nothing profile-shaped can run yet. The signed-in
	// branch awaits the import (the fetch overlaps the handshake's own
	// network round-trips); the signed-out branch only needs
	// `forgetBootstrappedThisSession`, whose module-level capture set is
	// trivially empty while the module was never loaded — so it consults the
	// cached handle instead of forcing the fetch.
	let profileServices: typeof ProfileServices | undefined;

	const loadProfileServices = async (): Promise<typeof ProfileServices> =>
		(profileServices ??= await import('$lib/services/profile.services'));

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

				// Drop the new-user capture: the next sign-in (even same principal,
				// same tab) must be judged fresh, so a returning user isn't re-run
				// through the onboarding drain's new-user branch.
				profileServices?.forgetBootstrappedThisSession();

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

				profileServices?.forgetBootstrappedThisSession();

				userStore.set({
					user: undefined,
					profile: undefined,
					authBusy: false,
					profileExisted: false
				});

				return;
			}

			const { ensureProfile } = await loadProfileServices();

			const { profile, existed } = await ensureProfile(user);

			setSignedInFlag(true);
			requestPersistentStorage();

			userStore.set({ user, profile, authBusy: false, profileExisted: existed });

			try {
				const [{ calculateAndSyncStats }, identity] = await Promise.all([
					loadProfileServices(),
					safeGetIdentityOnce()
				]);

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
