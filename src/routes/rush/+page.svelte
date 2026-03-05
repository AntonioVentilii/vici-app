<script lang="ts">
	import { onMount } from 'svelte';
	import RushMode from '$lib/components/market/RushMode.svelte';
	import { navStore } from '$lib/stores/nav.store';

	onMount(() => {
		navStore.set('rush');
	});
</script>

<div class="container mx-auto py-8">
	<RushMode />
</div>
