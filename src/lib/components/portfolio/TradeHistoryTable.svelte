<script lang="ts">
	import type { ClearingDid } from '$declarations';
	import Card from '$lib/components/ui/Card.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { Market } from '$lib/types/market';
	import { formatToken } from '$lib/utils/format.utils';

	interface Props {
		events: ClearingDid.Event[];
		markets: Market[];
	}

	const { events, markets }: Props = $props();

	const getMarketById = (id: string) => markets.find((m) => m.id === id);

	const formatPrice = (price: ClearingDid.Price) =>
		(Number(price.decimal.value) / 10 ** price.decimal.decimals).toFixed(
			price.decimal.decimals > 2 ? 4 : 2
		);

	const formatDate = (ns: bigint) =>
		new Date(Number(ns / 1_000_000n)).toLocaleString([], {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
</script>

<div class="space-y-4">
	<h2 class="text-xl font-bold tracking-wider text-slate-950 uppercase">Trade History</h2>
	<Card class="overflow-hidden rounded-2xl">
		{#if events.length === 0}
			<EmptyState message="No trade history found." />
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-left">
					<thead>
						<tr
							class="border-b border-slate-100 bg-slate-50 text-[10px] tracking-widest text-slate-500 uppercase"
						>
							<th class="px-6 py-4 font-black">Time</th>
							<th class="px-6 py-4 font-black">Market</th>
							<th class="px-6 py-4 font-black">Type</th>
							<th class="px-6 py-4 text-right font-black">Price</th>
							<th class="px-6 py-4 text-right font-black">Qty</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each events as event (event.event_id)}
							{@const market = getMarketById(event.series_id)}

							<tr class="group transition-colors hover:bg-slate-50">
								<td class="px-6 py-4 text-[10px] text-slate-500">
									{formatDate(event.timestamp)}
								</td>
								<td class="px-6 py-4">
									<div class="flex flex-col">
										<span class="text-sm font-bold text-slate-950">
											{market?.title ?? 'Unknown Market'}
										</span>
									</div>
								</td>
								<td class="px-6 py-4">
									<span class="text-[10px] font-bold text-slate-600 uppercase">
										{Object.keys(event.event_type)[0]}
									</span>
								</td>
								<td class="px-6 py-4 text-right text-sm font-bold text-slate-950">
									{formatPrice(event.price)}
								</td>
								<td class="px-6 py-4 text-right text-sm font-bold text-slate-950">
									{formatToken({ value: event.qty, unitName: market?.token.decimals ?? 8 })}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</div>
