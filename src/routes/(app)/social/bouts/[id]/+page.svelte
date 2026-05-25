<script lang="ts">
	import { page } from '$app/state';
	import BoutDetailPage from '$lib/components/pages/BoutDetailPage.svelte';

	const boutId = $derived(page.params.id ?? '');
</script>

<BoutDetailPage {boutId} />
