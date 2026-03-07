<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
	import { formatToken } from '$lib/utils/format.utils';

	interface Props {
		positions: Position[];
		markets: Market[];
		onCalculateValue: (pos: Position) => bigint;
		onCalculatePnL: (pos: Position) => number;
	}

	const { positions, markets, onCalculateValue, onCalculatePnL }: Props = $props();

	const getMarketById = (id: string) => markets.find((m) => m.id === id);
</script>

<div class="space-y-4">
	<h2 class="text-xl font-bold tracking-wider text-slate-950 uppercase">Active Positions</h2>
	<Card class="overflow-hidden rounded-2xl">
		{#if positions.length === 0}
			<EmptyState message="You haven't placed any predictions yet.">
				<a
					class="inline-block rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-indigo-500"
					href="/"
				>
					Explore Markets
				</a>
			</EmptyState>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-left">
					<thead>
						<tr
							class="border-b border-slate-100 bg-slate-50 text-[10px] tracking-widest text-slate-500 uppercase"
						>
							<th class="px-6 py-4 font-black">Market</th>
							<th class="px-6 py-4 font-black">Side</th>
							<th class="px-6 py-4 text-right font-black">Size</th>
							<th class="px-6 py-4 text-right font-black">Value</th>
							<th class="px-6 py-4 text-right font-black">P&L</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each positions as pos, index (index)}
							{@const market = getMarketById(pos.marketId)}
							{@const pnl = onCalculatePnL(pos)}

							<tr class="group transition-colors hover:bg-slate-50">
								<td class="px-6 py-4">
									<a class="group block max-w-xs" href="/(app)/markets/{pos.marketId}">
										<span
											class="line-clamp-1 text-sm font-bold text-slate-950 transition-colors group-hover:text-indigo-600"
										>
											{market?.title ?? 'Unknown Market'}
										</span>
										<span class="text-[10px] leading-none tracking-widest text-slate-400 uppercase"
											>ID: {pos.marketId}</span
										>
									</a>
								</td>
								<td class="px-6 py-4">
									<div class="flex gap-1.5">
										{#if pos.yesAmount > ZERO}
											<span
												class="rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-black tracking-tight text-green-700 uppercase"
												>YES</span
											>
										{/if}
										{#if pos.noAmount > ZERO}
											<span
												class="rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-black tracking-tight text-red-700 uppercase"
												>NO</span
											>
										{/if}
									</div>
								</td>
								<td class="px-6 py-4 text-right text-sm font-bold text-slate-950">
									{formatToken({
										value: pos.yesAmount + pos.noAmount,
										unitName: market?.token.decimals ?? 8
									})}
									<span class="text-[10px] text-slate-400">ICP</span>
								</td>
								<td class="px-6 py-4 text-right text-sm font-bold text-slate-950">
									{formatToken({
										value: onCalculateValue(pos),
										unitName: market?.token.decimals ?? 8
									})}
									<span class="text-[10px] text-slate-400">ICP</span>
								</td>
								<td class="px-6 py-4 text-right">
									<span class="text-sm font-black {pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
										{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</div>
