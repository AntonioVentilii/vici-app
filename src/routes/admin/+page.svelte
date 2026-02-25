<script lang="ts">
	import { onMount } from 'svelte';
	import AdminMarketForm from '$lib/components/admin/AdminMarketForm.svelte';
	import AdminResolutionHistory from '$lib/components/admin/AdminResolutionHistory.svelte';
	import AdminResolutionList from '$lib/components/admin/AdminResolutionList.svelte';
	import { mockBackend, type Market, type Outcome } from '$lib/services/mockBackend';

	let markets = $state<Market[]>([]);
	let loading = $state(true);

	// Create Market Form State
	let title = $state('');
	let description = $state('');
	let expiryDate = $state('');

	const fetchMarkets = async () => {
		markets = await mockBackend.getMarkets();
		loading = false;
	};

	onMount(fetchMarkets);

	const handleCreateMarket = async () => {
		if (!title || !description || !expiryDate) {
			return;
		}
		try {
			await mockBackend.createMarket(title, description, new Date(expiryDate).getTime());
			title = '';
			description = '';
			expiryDate = '';
			await fetchMarkets();
			alert('Market created successfully!');
		} catch (e: unknown) {
			alert((e as Error).message);
		}
	};

	const handleResolve = async ({ id, outcome }: { id: string; outcome: Outcome }) => {
		try {
			await mockBackend.resolveMarket(id, outcome);
			await fetchMarkets();
			alert(`Market ${id} resolved as ${outcome}`);
		} catch (e: unknown) {
			alert((e as Error).message);
		}
	};

	const unresolvedMarkets = $derived(markets.filter((m) => m.status !== 'Resolved'));
	const resolvedMarkets = $derived(markets.filter((m) => m.status === 'Resolved'));
</script>

<div class="space-y-12">
	<div class="space-y-4">
		<h1 class="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
			Admin Dashboard
		</h1>
		<p class="max-w-2xl text-lg text-slate-600">
			Manage markets, create new opportunities, and resolve expired predictions.
		</p>
	</div>

	<div class="grid grid-cols-1 gap-12 lg:grid-cols-2">
		<!-- Create Market Section -->
		<section class="space-y-8">
			<AdminMarketForm
				{description}
				{expiryDate}
				onCreate={handleCreateMarket}
				onDescriptionChange={(v) => (description = v)}
				onExpiryChange={(v) => (expiryDate = v)}
				onTitleChange={(v) => (title = v)}
				{title}
			/>
		</section>

		<!-- Resolve Markets Section -->
		<section class="space-y-8">
			<AdminResolutionList {loading} markets={unresolvedMarkets} onResolve={handleResolve} />

			<!-- Resolved History -->
			<AdminResolutionHistory markets={resolvedMarkets} />
		</section>
	</div>
</div>
