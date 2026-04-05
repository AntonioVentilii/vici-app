<script lang="ts">
	import { handleRedirectCallback } from '@junobuild/core';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(async () => {
		try {
			await handleRedirectCallback({
				google: null
			});

			await goto('/', { replaceState: true });
		} catch (err) {
			console.error('Failed to finish Google sign-in:', err);

			await goto('/');
		}
	});
</script>

<div class="flex h-screen w-full flex-col items-center justify-center gap-4">
	<div
		class="border-primary h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
	></div>
	<p class="animate-pulse text-lg font-medium">Completing sign-in...</p>
</div>
