<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import BettingInterface from '$lib/components/BettingInterface.svelte';
	import OutcomeBadge from '$lib/components/OutcomeBadge.svelte';
	import { mockBackend, type Market } from '$lib/services/mockBackend';

	const marketId = $derived(page.params.id);
	let market = $state<Market | null>(null);
	let loading = $state(true);

	const fetchMarket = async () => {
		market = await mockBackend.getMarket(marketId);
		loading = false;
	};

	onMount(fetchMarket);

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
				<div class="space-y-6">
					<div class="flex flex-wrap items-center gap-4">
						<OutcomeBadge status={market.status} />
						<span class="text-sm font-medium text-gray-500"
							>Market ID: <span class="font-mono text-gray-300">{market.id}</span></span
						>
					</div>

					<h1 class="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
						{market.title}
					</h1>

					<p class="text-xl leading-relaxed text-gray-400">
						{market.description}
					</p>
				</div>

				<!-- Stats Bar -->
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
						<div class="text-xs font-bold tracking-widest text-gray-500 uppercase">
							Total Volume
						</div>
						<div class="mt-2 text-2xl font-black text-white">
							{formatVolume(market.totalVolume)} ICP
						</div>
					</div>
					<div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
						<div class="text-xs font-bold tracking-widest text-gray-500 uppercase">Expiry Date</div>
						<div class="mt-2 text-2xl font-black text-white">
							{new Date(market.expiryDate).toLocaleDateString()}
						</div>
					</div>
					<div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
						<div class="text-xs font-bold tracking-widest text-gray-500 uppercase">
							Time Remaining
						</div>
						<div class="mt-2 text-2xl font-black text-indigo-400">
							{getTimeRemaining(market.expiryDate)}
						</div>
					</div>
				</div>

				<!-- Probabilities & Volume Breakdown -->
				<div class="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
					<h3 class="text-lg font-bold tracking-widest text-white uppercase">Market Forecast</h3>

					<div class="relative mt-8">
						<div class="mb-2 flex justify-between">
							<div class="flex flex-col">
								<span class="text-3xl font-black text-white"
									>{Math.round(market.yesProbability * 100)}%</span
								>
								<span class="text-xs font-medium text-green-400 uppercase">YES Probability</span>
							</div>
							<div class="flex flex-col items-end">
								<span class="text-3xl font-black text-white"
									>{Math.round(market.noProbability * 100)}%</span
								>
								<span class="text-xs font-medium text-red-400 uppercase">NO Probability</span>
							</div>
						</div>
						<div class="flex h-4 w-full overflow-hidden rounded-full bg-white/10">
							<div
								style="width: {market.yesProbability * 100}%"
								class="h-full bg-gradient-to-r from-green-500 to-emerald-400 shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all duration-700"
							></div>
							<div
								style="width: {market.noProbability * 100}%"
								class="h-full bg-gradient-to-l from-red-500 to-rose-400 shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all duration-700"
							></div>
						</div>
					</div>

					<div class="mt-12 grid grid-cols-2 gap-8 border-t border-white/5 pt-8">
						<div>
							<div class="mb-1 text-xs font-bold tracking-widest text-gray-500 uppercase">
								YES Volume
							</div>
							<div class="text-xl font-bold text-white">{formatVolume(market.yesVolume)} ICP</div>
						</div>
						<div class="text-right">
							<div class="mb-1 text-xs font-bold tracking-widest text-gray-500 uppercase">
								NO Volume
							</div>
							<div class="text-xl font-bold text-white">{formatVolume(market.noVolume)} ICP</div>
						</div>
					</div>
				</div>

				<!-- Chart Placeholder -->
				<div
					class="group relative flex h-64 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/5"
				>
					<div class="absolute inset-0 bg-gradient-to-t from-indigo-500/5 to-transparent"></div>
					<div class="relative z-10 space-y-2 text-center">
						<svg
							class="mx-auto h-10 w-10 text-indigo-400 opacity-50"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
							/>
						</svg>
						<p class="text-sm font-bold tracking-widest text-gray-400 uppercase">
							Historical Probability Chart
						</p>
						<p class="text-xs text-gray-600 italic">Feature coming soon in Next Phase</p>
					</div>
					<!-- Decorative Mock Lines -->
					<div class="pointer-events-none absolute right-0 bottom-10 left-0 h-20 px-4 opacity-10">
						<svg class="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 20">
							<path
								d="M0 15 Q 10 5, 20 18 T 40 10 T 60 15 T 80 5 T 100 12"
								fill="none"
								stroke="white"
								stroke-width="0.5"
							/>
						</svg>
					</div>
				</div>
			</div>

			<!-- Betting Sidebar -->
			<aside class="space-y-8">
				{#if market.status === 'Open'}
					<BettingInterface {market} on:betPlaced={fetchMarket} />
				{:else}
					<div
						class="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl"
					>
						<div class="flex justify-center">
							<div
								class="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-400"
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
						<h3 class="text-xl font-black tracking-wider text-white uppercase">Trading Closed</h3>
						<p class="text-gray-400">This market is no longer active.</p>
						{#if market.outcome}
							<div class="mt-4 border-t border-white/10 pt-4">
								<div class="text-xs font-bold tracking-widest text-gray-500 uppercase">
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
				<div class="space-y-4 rounded-3xl border border-white/10 bg-black/40 p-6">
					<h4 class="text-xs font-black tracking-widest text-gray-500 uppercase">
						Market Insights
					</h4>
					<div class="space-y-3">
						<div class="flex justify-between text-sm">
							<span class="text-gray-400">Creator</span>
							<span class="font-medium text-white">{market.creator.substring(0, 10)}...</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-gray-400">Invite Only</span>
							<span class="font-medium text-white">{market.isInviteOnly ? 'Yes' : 'No'}</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-gray-400">Liquidity</span>
							<span class="font-bold text-indigo-400">Medium</span>
						</div>
					</div>
				</div>

				<!-- Share Button -->
				<button
					class="group flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-4 text-sm font-bold text-white transition-all hover:bg-white/10"
				>
					<svg
						class="h-4 w-4 text-gray-400 transition-colors group-hover:text-indigo-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
						/>
					</svg>
					Share this Market
				</button>
			</aside>
		</div>
	{:else}
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<h1 class="text-4xl font-extrabold text-white">404 - Market Not Found</h1>
			<p class="mt-4 text-gray-400">
				The market you are seeking is either hidden or does not exist.
			</p>
			<a
				class="mt-8 rounded-xl bg-indigo-600 px-8 py-3 font-bold text-white transition-all hover:bg-indigo-500"
				href="/"
			>
				Return to Markets
			</a>
		</div>
	{/if}
</div>
