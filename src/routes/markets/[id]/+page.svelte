<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import BettingInterface from '$lib/components/market/BettingInterface.svelte';
	import OutcomeBadge from '$lib/components/market/OutcomeBadge.svelte';
	import { mockBackend, type Market } from '$lib/services/mockBackend';

	let market = $state<Market | null>(null);
	let loading = $state(true);

	const fetchMarket = async (id: string) => {
		loading = true;
		market = await mockBackend.getMarket(id);
		loading = false;
	};

	onMount(() => {
		if (page.params.id) {
			fetchMarket(page.params.id);
		}
	});

	$effect(() => {
		if (page.params.id && (!market || market.id !== page.params.id)) {
			fetchMarket(page.params.id);
		}
	});

	const getTimeRemaining = (expiry: number) => {
		const now = Date.now();
		const diff = expiry - now;
		if (diff <= 0) {
			return 'Expired';
		}

		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

		if (days > 0) {
			return `${days}d ${hours}h ${minutes}m`;
		}
		return `${hours}h ${minutes}m remaining`;
	};

	const formatVolume = (v: bigint) => (Number(v) / 100_000_000).toFixed(2);
</script>

<svelte:head>
	<title>{market ? market.title : 'Market'} | Vici Social Markets</title>
</svelte:head>

<div class="space-y-12">
	{#if loading}
		<div class="flex h-96 items-center justify-center">
			<div
				class="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"
			></div>
		</div>
	{:else if market}
		<!-- Market Header -->
		<div class="grid grid-cols-1 gap-12 lg:grid-cols-3">
			<div class="space-y-8 lg:col-span-2">
				<!-- Header -->
				<div class="space-y-4">
					<div class="flex flex-wrap items-center gap-4">
						<OutcomeBadge status={market.status} />
						<span class="text-sm font-medium text-slate-500"
							>Market ID: <span class="font-mono text-slate-400">{market.id}</span></span
						>
					</div>
					<h1 class="text-4xl font-black text-slate-950 sm:text-5xl lg:text-6xl">
						{market.title}
					</h1>
					<p class="text-xl text-slate-600">
						{market.description}
					</p>
				</div>

				<!-- Stats Area -->
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						<div class="text-xs font-bold tracking-widest text-slate-500 uppercase">
							Total Volume
						</div>
						<div class="mt-2 text-2xl font-black text-slate-950">
							{formatVolume(market.totalVolume)} ICP
						</div>
					</div>
					<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						<div class="text-xs font-bold tracking-widest text-slate-500 uppercase">
							Expiry Date
						</div>
						<div class="mt-2 text-2xl font-black text-slate-950">
							{new Date(market.expiryDate).toLocaleDateString()}
						</div>
					</div>
					<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						<div class="text-xs font-bold tracking-widest text-slate-500 uppercase">
							Time Remaining
						</div>
						<div class="mt-2 text-2xl font-black text-indigo-600">
							{getTimeRemaining(market.expiryDate)}
						</div>
					</div>
				</div>

				<!-- Probabilities Area -->
				<div class="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
					<h3 class="text-lg font-bold tracking-widest text-slate-500 uppercase">
						Market Forecast
					</h3>

					<div class="relative mt-8">
						<div class="mb-2 flex justify-between">
							<div class="flex flex-col">
								<span class="text-3xl font-black text-slate-950"
									>{Math.round(market.yesProbability * 100)}%</span
								>
								<span class="text-xs font-bold text-green-600 uppercase">YES Probability</span>
							</div>
							<div class="flex flex-col items-end">
								<span class="text-3xl font-black text-slate-950"
									>{Math.round(market.noProbability * 100)}%</span
								>
								<span class="text-xs font-bold text-red-600 uppercase">NO Probability</span>
							</div>
						</div>
						<div class="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
							<div
								style="width: {market.yesProbability * 100}%"
								class="h-full bg-green-500 transition-all duration-700"
							></div>
							<div
								style="width: {market.noProbability * 100}%"
								class="h-full bg-red-500 transition-all duration-700"
							></div>
						</div>
					</div>

					<div class="mt-12 grid grid-cols-2 gap-8 border-t border-slate-100 pt-8">
						<div>
							<div class="mb-1 text-xs font-bold tracking-widest text-slate-500 uppercase">
								YES Volume
							</div>
							<div class="text-xl font-bold text-slate-950">
								{formatVolume(market.yesVolume)} ICP
							</div>
						</div>
						<div class="text-right">
							<div class="mb-1 text-xs font-bold tracking-widest text-slate-500 uppercase">
								NO Volume
							</div>
							<div class="text-xl font-bold text-slate-950">
								{formatVolume(market.noVolume)} ICP
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Betting Sidebar -->
			<aside class="space-y-8">
				{#if market.status === 'Open'}
					<BettingInterface {market} on:betPlaced={() => fetchMarket(market?.id ?? '')} />
				{:else}
					<div
						class="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"
					>
						<div class="flex justify-center">
							<div
								class="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600"
							>
								<svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										d="M12 15v2m0 0v3m0-3h3m-3 0H9m12-3a9 9 0 11-18 0 9 9 0 0118 0z"
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
									/>
								</svg>
							</div>
						</div>
						<h3 class="text-xl font-black tracking-wider text-slate-950 uppercase">
							Trading Closed
						</h3>
						<p class="text-slate-600">This market is no longer active.</p>
						{#if market.outcome}
							<div class="mt-4 border-t border-slate-100 pt-4">
								<div class="text-xs font-bold tracking-widest text-slate-500 uppercase">
									Resolution Outcome
								</div>
								<div class="mt-2">
									<OutcomeBadge outcome={market.outcome} />
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Depth Info -->
				<div class="space-y-4 rounded-3xl border border-slate-100 bg-slate-50 p-6">
					<h4 class="text-xs font-black tracking-widest text-slate-500 uppercase">
						Market Insights
					</h4>
					<div class="space-y-3">
						<div class="flex justify-between text-sm">
							<span class="text-slate-500">Creator</span>
							<span class="font-medium text-slate-950">{market.creator.substring(0, 10)}...</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-slate-500">Invite Only</span>
							<span class="font-medium text-slate-950">{market.isInviteOnly ? 'Yes' : 'No'}</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-slate-500">Liquidity</span>
							<span class="font-bold text-indigo-600">Medium</span>
						</div>
					</div>
				</div>
			</aside>
		</div>
	{:else}
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<h1 class="text-4xl font-extrabold text-slate-950">404 - Market Not Found</h1>
			<p class="mt-4 text-slate-600">
				The market you are seeking is either hidden or does not exist.
			</p>
			<a
				class="mt-8 rounded-xl bg-indigo-600 px-8 py-3 font-bold text-white transition-all hover:bg-indigo-700"
				href="/"
			>
				Return to Markets
			</a>
		</div>
	{/if}
</div>
