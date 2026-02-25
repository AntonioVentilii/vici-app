<script lang="ts">
	import { onMount } from 'svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import StatCard from '$lib/components/ui/StatCard.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { mockBackend, type Market, type Position } from '$lib/services/mockBackend';

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
		if (!market) {
			return ZERO;
		}

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

	const totalPortfolioValue = $derived(
		positions.reduce((acc, pos) => acc + calculateValue(pos), ZERO)
	);

	const totalPnL = $derived(positions.reduce((acc, pos) => acc + calculatePnL(pos), 0));
</script>

<div class="space-y-12">
	<SectionHeader
		description="Track your active predictions and see how your trades are performing in real-time."
		highlight="Portfolio"
		title="My"
	/>

	{#if loading}
		<LoadingSpinner />
	{:else}
		<!-- Stats Summary -->
		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<StatCard label="Total Holdings" unit="ICP" value={formatAmount(totalPortfolioValue)} />

			<StatCard
				label="Unrealized P&L"
				unit="ICP"
				value={(totalPnL >= 0 ? '+' : '') + totalPnL.toFixed(2)}
				valueClass={totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}
			/>

			<StatCard label="Active Markets" value={positions.length} />
		</div>

		<!-- Positions Table -->
		<div class="space-y-6">
			<h2 class="text-2xl font-bold tracking-wider text-white uppercase">Active Positions</h2>

			<Card class="overflow-hidden">
				{#if positions.length === 0}
					<EmptyState message="You haven't placed any bets yet.">
						<a
							class="inline-block rounded-xl bg-indigo-600 px-8 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-500"
							href="/"
						>
							Explore Markets
						</a>
					</EmptyState>
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
							{#each positions as pos, index (index)}
								{@const market = getMarketById(pos.marketId)}
								{@const pnl = calculatePnL(pos)}
								<tr class="group transition-colors hover:bg-white/5">
									<td class="px-8 py-6">
										<a class="group block max-w-xs" href="/markets/{pos.marketId}">
											<span
												class="line-clamp-1 text-sm font-bold text-white transition-colors group-hover:text-indigo-400"
											>
												{market?.title ?? 'Unknown Market'}
											</span>
											<span class="text-[10px] leading-none tracking-widest text-gray-500 uppercase"
												>ID: {pos.marketId}</span
											>
										</a>
									</td>
									<td class="px-8 py-6">
										<div class="flex gap-2">
											{#if pos.yesAmount > ZERO}
												<span
													class="rounded-lg border border-green-500/20 bg-green-500/10 px-2 py-1 text-[10px] font-black tracking-tighter text-green-400 uppercase"
													>YES</span
												>
											{/if}
											{#if pos.noAmount > ZERO}
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
			</Card>
		</div>
	{/if}
</div>
