<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import { onAuthStateChange, type User } from '@junobuild/core';
	import { onMount, type Snippet } from 'svelte';
	import { getProfile } from '$lib/services/profile.services';
	import { userStore } from '$lib/stores/user.store';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();

	const updateUserStore = async (user: User | null) => {
		if (isNullish(user)) {
			userStore.set({ user: null, profile: undefined });

			return;
		}

		const { key: userText } = user;

		if (isNullish(userText)) {
			userStore.set({ user: null, profile: undefined });

			return;
		}

		const profile = await getProfile(userText);

		userStore.set({ user, profile });
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
