<script lang="ts">
	import { onMount } from 'svelte';
	import OutcomeBadge from '$lib/components/market/OutcomeBadge.svelte';
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
			<div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
				<h2 class="mb-6 text-2xl font-bold text-slate-950">Create New Market</h2>
				<div class="space-y-6">
					<div class="space-y-2">
						<label
							class="text-xs font-bold tracking-widest text-gray-500 uppercase"
							for="market-title"
						>
							Market Title
						</label>
						<input
							id="market-title"
							class="w-full rounded-2xl border-none bg-slate-50 px-6 py-4 text-slate-950 ring-1 ring-slate-200 ring-inset focus:ring-2 focus:ring-indigo-500"
							placeholder="e.g., Will Bitcoin hit $100k by 2027?"
							type="text"
							bind:value={title}
						/>
					</div>

					<div class="space-y-2">
						<label
							class="text-xs font-bold tracking-widest text-gray-500 uppercase"
							for="market-description"
						>
							Description
						</label>
						<textarea
							id="market-description"
							class="w-full rounded-2xl border-none bg-slate-50 px-6 py-4 text-slate-950 ring-1 ring-slate-200 ring-inset focus:ring-2 focus:ring-indigo-500"
							placeholder="Provide detailed criteria for resolution..."
							rows="4"
							bind:value={description}
						></textarea>
					</div>

					<div class="space-y-2">
						<label
							class="text-xs font-bold tracking-widest text-gray-500 uppercase"
							for="expiry-date">Expiry Date</label
						>
						<input
							id="expiry-date"
							class="w-full rounded-2xl border-none bg-slate-50 px-6 py-4 text-slate-950 ring-1 ring-slate-200 ring-inset focus:ring-2 focus:ring-indigo-500"
							type="datetime-local"
							bind:value={expiryDate}
						/>
					</div>

					<button
						class="w-full rounded-2xl bg-indigo-600 py-4 text-sm font-black text-white shadow-xl shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-[0.98]"
						onclick={handleCreateMarket}
					>
						Deploy Market
					</button>
				</div>
			</div>
		</section>

		<!-- Resolve Markets Section -->
		<section class="space-y-8">
			<div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
				<h2 class="mb-6 text-2xl font-bold text-slate-950">Resolve Active Markets</h2>

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
							<div class="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-6">
								<div class="flex items-start justify-between">
									<h3 class="line-clamp-1 font-bold text-slate-950">{market.title}</h3>
									<span class="font-mono text-[10px] text-slate-500">ID: {market.id}</span>
								</div>

								<div class="flex gap-2">
									<button
										class="flex-1 rounded-xl border border-green-500/20 bg-green-500/10 py-2 text-xs font-bold text-green-400 transition-all hover:bg-green-500/20"
										onclick={() => handleResolve(market.id, 'YES')}
									>
										Resolve YES
									</button>
									<button
										class="flex-1 rounded-xl border border-red-500/20 bg-red-500/10 py-2 text-xs font-bold text-red-400 transition-all hover:bg-red-500/20"
										onclick={() => handleResolve(market.id, 'NO')}
									>
										Resolve NO
									</button>
									<button
										class="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-bold text-gray-400 transition-all hover:bg-white/10"
										onclick={() => handleResolve(market.id, 'CANCELED')}
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
			<div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
				<h2 class="mb-6 text-2xl font-bold text-slate-950">Recent Resolutions</h2>
				<div class="space-y-4">
					{#each resolvedMarkets.slice(0, 5) as market (market.id)}
						<div
							class="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0"
						>
							<span class="line-clamp-1 text-sm text-slate-600">{market.title}</span>
							<OutcomeBadge outcome={market.outcome} />
						</div>
					{/each}
				</div>
			</div>
		</section>
	</div>
</div>
