<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { PublicPath } from '$lib/constants/routes.constants';

	// Backward-compat alias. `/welcome` is the legacy marketing URL;
	// `/about` is the canonical share-able destination.
	onMount(() => {
		void goto(resolve(PublicPath.About), { replaceState: true });
	});
</script>
