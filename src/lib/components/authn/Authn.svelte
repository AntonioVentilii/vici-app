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
		if (isNullish(user)) {
			userStore.set({ user: undefined, profile: undefined });

			return;
		}

		const { key: userText } = user;

		if (isNullish(userText)) {
			userStore.set({ user: undefined, profile: undefined });

			return;
		}

		const profile = await ensureProfile(user);

		userStore.set({ user, profile });

		try {
			const identity = await safeGetIdentityOnce();

			await calculateAndSyncStats({ identity, domain: $balanceDomain });
		} catch (e) {
			console.error('Failed to sync stats on login', e);
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
