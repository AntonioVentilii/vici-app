<script lang="ts">
	import type { ClearingDid } from '$declarations';
	import Card from '$lib/components/ui/Card.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { PORTFOLIO_DEFAULT_DECIMALS } from '$lib/constants/portfolio.constants';
	import type { Market } from '$lib/types/market';
	import { formatPrice, formatQuantity, formatNanosecondsToDate } from '$lib/utils/format.utils';

	interface Props {
		events: ClearingDid.Event[];
		markets: Market[];
	}

	const { events, markets }: Props = $props();

	const getMarketById = (id: string) => markets.find((m) => m.id === id);
</script>

<div class="space-y-4">
	<h2 class="text-xl font-bold tracking-wider text-foreground uppercase">Trade History</h2>
	<Card class="overflow-hidden" padding="none">
		{#if events.length === 0}
			<EmptyState message="No trade history found." />
		{:else}
			<div class="flex w-full min-w-0 overflow-x-auto">
				<table class="w-full min-w-0 table-fixed text-left">
					<thead>
						<tr
							class="border-b border-border bg-foreground/5 text-[10px] tracking-widest text-muted-foreground uppercase"
						>
							<th class="px-6 py-4 font-black">Time</th>
							<th class="px-6 py-4 font-black">Market</th>
							<th class="px-6 py-4 font-black">Type</th>
							<th class="px-6 py-4 text-right font-black">Price</th>
							<th class="px-6 py-4 text-right font-black">Qty</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each events as event (event.event_id)}
							{@const market = getMarketById(event.series_id)}

							<tr class="group transition-colors hover:bg-foreground/5">
								<td class="px-6 py-4 text-[10px] text-muted-foreground">
									{formatNanosecondsToDate({ nanoseconds: event.timestamp })}
								</td>
								<td class="min-w-0 px-6 py-4">
									<div class="flex min-w-0 flex-col">
										<span class="block truncate text-sm font-bold text-foreground">
											{market?.title ?? 'Unknown Market'}
										</span>
									</div>
								</td>
								<td class="px-6 py-4">
									<span class="text-[10px] font-bold text-muted-foreground uppercase">
										{Object.keys(event.event_type)[0]}
									</span>
								</td>
								<td class="px-6 py-4 text-right text-sm font-bold text-foreground">
									{formatPrice(event.price)}
								</td>
								<td class="px-6 py-4 text-right text-sm font-bold text-foreground">
									{formatQuantity({
										value: event.qty,
										decimals: market?.token.decimals ?? PORTFOLIO_DEFAULT_DECIMALS
									})}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</div>
