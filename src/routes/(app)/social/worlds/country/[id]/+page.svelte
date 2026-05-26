<script lang="ts">
	import { page } from '$app/state';
	import WorldsAffiliationDetailPage from '$lib/components/pages/WorldsAffiliationDetailPage.svelte';

	const affiliationId = $derived(page.params.id ?? '');
</script>

<WorldsAffiliationDetailPage {affiliationId} kind="country" />
