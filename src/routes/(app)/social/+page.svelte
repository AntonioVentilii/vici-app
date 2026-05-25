<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { AppPath } from '$lib/constants/routes.constants';

	// Placeholder until the tabbed Social screen lands. The prototype's
	// /social is a 3-tab page (Friends / Leagues / Bouts) — until that
	// component is built, send users to the Leagues sub-surface.
	onMount(() => {
		void goto(`${resolve(AppPath.Social)}/leagues`, { replaceState: true });
	});
</script>
