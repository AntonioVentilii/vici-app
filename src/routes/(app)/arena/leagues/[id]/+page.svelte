<script lang="ts">
	import { page } from '$app/state';
	import LeagueDetailPage from '$lib/components/pages/LeagueDetailPage.svelte';

	const leagueId = $derived(page.params.id ?? '');
</script>

<LeagueDetailPage {leagueId} />
