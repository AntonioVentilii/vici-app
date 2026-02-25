<script lang="ts">
	import OutcomeBadge from '$lib/components/OutcomeBadge.svelte';
	import { mockBackend, type Market, type Outcome } from '$lib/services/mockBackend';
	import { onMount } from 'svelte';

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
		if (!title || !description || !expiryDate) return;
		try {
			await mockBackend.createMarket(title, description, new Date(expiryDate).getTime());
			title = '';
			description = '';
			expiryDate = '';
			await fetchMarkets();
			alert('Market created successfully!');
		} catch (e: any) {
			alert(e.message);
		}
	};

	const handleResolve = async (id: string, outcome: Outcome) => {
		try {
			await mockBackend.resolveMarket(id, outcome);
			await fetchMarkets();
			alert(`Market ${id} resolved as ${outcome}`);
		} catch (e: any) {
			alert(e.message);
		}
	};

	let unresolvedMarkets = $derived(markets.filter((m) => m.status !== 'Resolved'));
	let resolvedMarkets = $derived(markets.filter((m) => m.status === 'Resolved'));
</script>

<div class="space-y-12">
	<div class="space-y-4">
		<h1 class="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Admin Dashboard</h1>
		<p class="max-w-2xl text-lg text-gray-400">
			Manage markets, create new opportunities, and resolve expired predictions.
		</p>
	</div>

	<div class="grid grid-cols-1 gap-12 lg:grid-cols-2">
		<!-- Create Market Section -->
		<section class="space-y-8">
			<div class="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
				<h2 class="mb-6 text-2xl font-bold text-white">Create New Market</h2>
				<div class="space-y-6">
					<div class="space-y-2">
						<label class="text-xs font-bold tracking-widest text-gray-500 uppercase"
							>Market Title</label
						>
						<input
							type="text"
							bind:value={title}
							placeholder="e.g., Will Bitcoin hit $100k by 2027?"
							class="w-full rounded-2xl border-none bg-white/5 px-6 py-4 text-white ring-1 ring-white/10 ring-inset focus:ring-2 focus:ring-indigo-500"
						/>
					</div>

					<div class="space-y-2">
						<label class="text-xs font-bold tracking-widest text-gray-500 uppercase"
							>Description</label
						>
						<textarea
							bind:value={description}
							rows="4"
							placeholder="Provide detailed criteria for resolution..."
							class="w-full rounded-2xl border-none bg-white/5 px-6 py-4 text-white ring-1 ring-white/10 ring-inset focus:ring-2 focus:ring-indigo-500"
						></textarea>
					</div>

					<div class="space-y-2">
						<label class="text-xs font-bold tracking-widest text-gray-500 uppercase"
							>Expiry Date</label
						>
						<input
							type="datetime-local"
							bind:value={expiryDate}
							class="w-full rounded-2xl border-none bg-white/5 px-6 py-4 text-white [color-scheme:dark] ring-1 ring-white/10 ring-inset focus:ring-2 focus:ring-indigo-500"
						/>
					</div>

					<button
						onclick={handleCreateMarket}
						class="w-full rounded-2xl bg-indigo-600 py-4 text-sm font-black text-white shadow-xl shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-[0.98]"
					>
						Deploy Market
					</button>
				</div>
			</div>
		</section>

		<!-- Resolve Markets Section -->
		<section class="space-y-8">
			<div class="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
				<h2 class="mb-6 text-2xl font-bold text-white">Resolve Active Markets</h2>

				{#if loading}
					<div class="flex justify-center py-12">
						<div
							class="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"
						></div>
					</div>
				{:else if unresolvedMarkets.length === 0}
					<p class="py-12 text-center text-sm text-gray-500 italic">
						No active markets requiring resolution.
					</p>
				{:else}
					<div class="space-y-6">
						{#each unresolvedMarkets as market (market.id)}
							<div class="space-y-4 rounded-2xl border border-white/5 bg-black/40 p-6">
								<div class="flex items-start justify-between">
									<h3 class="line-clamp-1 font-bold text-white">{market.title}</h3>
									<span class="font-mono text-[10px] text-gray-500">ID: {market.id}</span>
								</div>

								<div class="flex gap-2">
									<button
										onclick={() => handleResolve(market.id, 'YES')}
										class="flex-1 rounded-xl border border-green-500/20 bg-green-500/10 py-2 text-xs font-bold text-green-400 transition-all hover:bg-green-500/20"
									>
										Resolve YES
									</button>
									<button
										onclick={() => handleResolve(market.id, 'NO')}
										class="flex-1 rounded-xl border border-red-500/20 bg-red-500/10 py-2 text-xs font-bold text-red-400 transition-all hover:bg-red-500/20"
									>
										Resolve NO
									</button>
									<button
										onclick={() => handleResolve(market.id, 'CANCELED')}
										class="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-bold text-gray-400 transition-all hover:bg-white/10"
									>
										Cancel
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Resolved History -->
			<div class="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
				<h2 class="mb-6 text-2xl font-bold text-white">Recent Resolutions</h2>
				<div class="space-y-4">
					{#each resolvedMarkets.slice(0, 5) as market (market.id)}
						<div
							class="flex items-center justify-between border-b border-white/5 pb-4 last:border-0 last:pb-0"
						>
							<span class="line-clamp-1 text-sm text-gray-300">{market.title}</span>
							<OutcomeBadge outcome={market.outcome} />
						</div>
					{/each}
				</div>
			</div>
		</section>
	</div>
</div>
