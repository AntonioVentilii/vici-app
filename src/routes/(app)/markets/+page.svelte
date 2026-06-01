<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { AppPath } from '$lib/constants/routes.constants';

	// Redirect alias. The markets list now lives on the canonical home
	// surface (`/app`, which renders `MarketsPage`); the Markets nav tab
	// targets it directly. A bare `/markets` is kept only as a redirect so
	// older links land on the canonical list. This `+page.svelte` matches
	// the exact `/markets` path — the `/markets/[id]` detail child route is
	// untouched and still resolves on its own.
	onMount(() => {
		void goto(resolve(AppPath.Home), { replaceState: true });
	});
</script>

<div class="flex min-h-screen w-full items-center justify-center p-6" aria-hidden="true">
	<LoadingSpinner size="md" />
</div>
