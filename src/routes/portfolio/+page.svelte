<script lang="ts">
	import { mockBackend, type Market, type Position } from '$lib/services/mockBackend';
	import { onMount } from 'svelte';

	let positions = $state<Position[]>([]);
	let markets = $state<Market[]>([]);
	let loading = $state(true);

	onMount(async () => {
		[positions, markets] = await Promise.all([
			mockBackend.getPositions(),
			mockBackend.getMarkets()
		]);
		loading = false;
	});

	const getMarketById = (id: string) => markets.find((m) => m.id === id);

	const calculateValue = (pos: Position) => {
		const market = getMarketById(pos.marketId);
		if (!market) return 0n;

		// Simple value projection: amount * current probability
		const yesVal = Number(pos.yesAmount) * market.yesProbability;
		const noVal = Number(pos.noAmount) * market.noProbability;
		return BigInt(Math.floor(yesVal + noVal));
	};

	const calculatePnL = (pos: Position) => {
		const totalCost = pos.yesAmount + pos.noAmount;
		const currentValue = calculateValue(pos);
		return Number(currentValue - totalCost) / 100_000_000;
	};

	const formatAmount = (v: bigint) => (Number(v) / 100_000_000).toFixed(2);

	let totalPortfolioValue = $derived(positions.reduce((acc, pos) => acc + calculateValue(pos), 0n));

	let totalPnL = $derived(positions.reduce((acc, pos) => acc + calculatePnL(pos), 0));
</script>

<div class="space-y-12">
	<!-- Page Header -->
	<div class="space-y-4">
		<h1 class="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
			My <span class="text-indigo-400">Portfolio</span>
		</h1>
		<p class="max-w-2xl text-lg text-gray-400">
			Track your active predictions and see how your trades are performing in real-time.
		</p>
	</div>

	{#if loading}
		<div class="flex justify-center py-24">
			<div
				class="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"
			></div>
		</div>
	{:else}
		<!-- Stats Summary -->
		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<div class="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
				<div class="text-xs font-bold tracking-[0.2em] text-gray-500 uppercase">Total Holdings</div>
				<div class="mt-2 flex items-baseline gap-2">
					<span class="text-4xl font-black text-white">{formatAmount(totalPortfolioValue)}</span>
					<span class="text-sm font-bold text-gray-500 uppercase">ICP</span>
				</div>
			</div>

			<div class="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
				<div class="text-xs font-bold tracking-[0.2em] text-gray-500 uppercase">Unrealized P&L</div>
				<div class="mt-2 flex items-baseline gap-2">
					<span class="text-4xl font-black {totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}">
						{totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}
					</span>
					<span class="text-sm font-bold text-gray-500 uppercase">ICP</span>
				</div>
			</div>

			<div class="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
				<div class="text-xs font-bold tracking-[0.2em] text-gray-500 uppercase">Active Markets</div>
				<div class="mt-2 text-4xl font-black text-white">{positions.length}</div>
			</div>
		</div>

		<!-- Positions Table -->
		<div class="space-y-6">
			<h2 class="text-2xl font-bold tracking-wider text-white uppercase">Active Positions</h2>

			<div class="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
				{#if positions.length === 0}
					<div class="space-y-4 py-20 text-center">
						<div
							class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-gray-500"
						>
							<svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</div>
						<p class="font-medium text-gray-400">You haven't placed any bets yet.</p>
						<a
							href="/"
							class="inline-block rounded-xl bg-indigo-600 px-8 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-500"
						>
							Explore Markets
						</a>
					</div>
				{:else}
					<table class="w-full text-left">
						<thead>
							<tr
								class="border-b border-white/10 bg-white/5 text-[10px] tracking-[0.2em] text-gray-500 uppercase"
							>
								<th class="px-8 py-5 font-black">Market</th>
								<th class="px-8 py-5 font-black">Side</th>
								<th class="px-8 py-5 text-right font-black">Size</th>
								<th class="px-8 py-5 text-right font-black">Current Value</th>
								<th class="px-8 py-5 text-right font-black">P&L</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5">
							{#each positions as pos}
								{@const market = getMarketById(pos.marketId)}
								{@const pnl = calculatePnL(pos)}
								<tr class="group transition-colors hover:bg-white/5">
									<td class="px-8 py-6">
										<a href="/markets/{pos.marketId}" class="group block max-w-xs">
											<span
												class="line-clamp-1 text-sm font-bold text-white transition-colors group-hover:text-indigo-400"
											>
												{market?.title || 'Unknown Market'}
											</span>
											<span class="text-[10px] leading-none tracking-widest text-gray-500 uppercase"
												>ID: {pos.marketId}</span
											>
										</a>
									</td>
									<td class="px-8 py-6">
										<div class="flex gap-2">
											{#if pos.yesAmount > 0n}
												<span
													class="rounded-lg border border-green-500/20 bg-green-500/10 px-2 py-1 text-[10px] font-black tracking-tighter text-green-400 uppercase"
													>YES</span
												>
											{/if}
											{#if pos.noAmount > 0n}
												<span
													class="rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] font-black tracking-tighter text-red-400 uppercase"
													>NO</span
												>
											{/if}
										</div>
									</td>
									<td class="px-8 py-6 text-right font-bold text-white">
										{formatAmount(pos.yesAmount + pos.noAmount)}
										<span class="text-[10px] text-gray-500">ICP</span>
									</td>
									<td class="px-8 py-6 text-right font-bold text-white">
										{formatAmount(calculateValue(pos))}
										<span class="text-[10px] text-gray-500">ICP</span>
									</td>
									<td class="px-8 py-6 text-right">
										<span class="font-black {pnl >= 0 ? 'text-green-400' : 'text-red-400'}">
											{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		</div>
	{/if}
</div>
