<script lang="ts">
	import { page } from '$app/state';
	import WorldsAffiliationDetailPage from '$lib/components/pages/WorldsAffiliationDetailPage.svelte';

	const affiliationIdentifier = $derived(page.params.id ?? '');
</script>

<WorldsAffiliationDetailPage {affiliationIdentifier} kind="country" />
