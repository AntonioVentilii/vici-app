<script lang="ts">
	import { page } from '$app/state';
	import BattleDetailPage from '$lib/components/pages/BattleDetailPage.svelte';

	const battleId = $derived(page.params.id ?? '');
</script>

<BattleDetailPage {battleId} />
