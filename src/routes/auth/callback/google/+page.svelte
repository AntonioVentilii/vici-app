<script lang="ts">
	import { handleRedirectCallback } from '@junobuild/core';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	onMount(async () => {
		try {
			await handleRedirectCallback({
				google: null
			});

			await goto('/', { replaceState: true });
		} catch (err: unknown) {
			console.error('Failed to finish Google sign-in:', err);

			await goto('/');
		}
	});
</script>

<div class="flex h-screen w-full flex-col items-center justify-center gap-4">
	<div
		class="border-primary h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
	></div>
	<p class="animate-pulse text-lg font-medium">
		{t({ locale: $localeStore, key: 'auth.callback.google.completing' })}
	</p>
</div>
