<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import { onAuthStateChange, type User } from '@junobuild/core';
	import { onMount, type Snippet } from 'svelte';
	import { getProfile } from '$lib/services/profile.services';
	import { userStore } from '$lib/stores/user.store';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();

	const updateUserStore = async (user: User | null) => {
		if (nonNullish(user)) {
			const profile = await getProfile(user);

			userStore.set({ user, profile });

			return;
		}

		userStore.set({ user: null, profile: undefined });
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

<div>
	{@render children()}
</div>
