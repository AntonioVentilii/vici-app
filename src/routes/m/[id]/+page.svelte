<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { setPinnedFlowMarket } from '$lib/utils/flow-pin.utils';

	// Short share-link alias. The share sheet hands out `/m/{id}?ref=…`
	// (compact enough for SMS / social), while `/markets/{id}` is the
	// canonical detail route. Bounce to it on mount, carrying the query
	// string through so referral attribution survives the hop. A bare
	// alias kept this thin — no auth branching here; the (app) gate on
	// the destination owns the signed-out path.
	const id = $derived(page.params.id ?? '');

	onMount(() => {
		// This route is only ever reached from a shared link, so park the
		// market for the next Flow entry to surface as the first card —
		// surviving the detail page, sign-in, and (for a new user)
		// onboarding. Dropped downstream if the viewer already called it.
		setPinnedFlowMarket(id);

		const { search } = page.url;
		void goto(`${resolve(`${AppPath.Markets}/${id}`)}${search}`, { replaceState: true });
	});
</script>

<div class="flex min-h-screen w-full items-center justify-center p-6" aria-hidden="true">
	<LoadingSpinner size="md" />
</div>
