<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import { onAuthStateChange, type User } from '@junobuild/core';
	import { onMount, type Snippet } from 'svelte';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import { ensureProfile, calculateAndSyncStats } from '$lib/services/profile.services';
	import { userStore } from '$lib/stores/user.store';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();

	const updateUserStore = async (user: User | null) => {
		userStore.update((data) => ({ ...data, authBusy: true }));

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
			} catch (e) {
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

	// eslint-disable-next-line no-console
	const automaticSignOut = () => console.log('Automatically signed out because session expired');
</script>

<svelte:window onjunoSignOutAuthTimer={automaticSignOut} />

{@render children()}
