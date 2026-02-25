<script lang="ts">
	import { onAuthStateChange } from '@junobuild/core';
	import { onDestroy, onMount, type Snippet } from 'svelte';
	import Login from '$lib/components/Login.svelte';
	import Logout from '$lib/components/Logout.svelte';
	import { userSignedIn } from '$lib/derived/user.derived';
	import { userStore } from '$lib/stores/user.store';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();

	let unsubscribe: (() => void) | undefined = undefined;

	onMount(() => (unsubscribe = onAuthStateChange((user) => userStore.set(user))));

	// eslint-disable-next-line no-console
	const automaticSignOut = () => console.log('Automatically signed out because session expired');

	onDestroy(() => unsubscribe?.());
</script>

<svelte:window onjunoSignOutAuthTimer={automaticSignOut} />

{#if $userSignedIn}
	<div>
		{@render children()}

		<Logout />
	</div>
{:else}
	<div class="gap flex flex-col">
		<Login />
	</div>
{/if}
