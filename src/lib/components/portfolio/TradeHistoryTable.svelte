<script lang="ts">
	import type { ClearingDid } from '$declarations';
	import Card from '$lib/components/ui/Card.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { PORTFOLIO_DEFAULT_DECIMALS } from '$lib/constants/portfolio.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import { formatPrice, formatQuantity, formatNanosecondsToDate } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		events: ClearingDid.Event[];
		markets: Market[];
	}

	const { events, markets }: Props = $props();

	const getMarketById = (id: string) => markets.find((m) => m.id === id);
</script>

<div class="space-y-4">
	<h2 class="text-foreground text-xl font-bold tracking-wider uppercase">
		{t({ locale: $localeStore, key: 'portfolio.trades.title' })}
	</h2>
	<Card class="overflow-hidden" padding="none">
		{#if events.length === 0}
			<EmptyState message={t({ locale: $localeStore, key: 'portfolio.trades.empty' })} />
		{:else}
			<div class="flex w-full min-w-0 overflow-x-auto">
				<table class="w-full min-w-0 table-fixed text-left">
					<thead>
						<tr
							class="border-border bg-foreground/5 text-muted-foreground border-b text-[10px] tracking-widest uppercase"
						>
							<th class="px-6 py-4 font-black"
								>{t({ locale: $localeStore, key: 'portfolio.trades.col.time' })}</th
							>
							<th class="px-6 py-4 font-black"
								>{t({ locale: $localeStore, key: 'portfolio.trades.col.market' })}</th
							>
							<th class="px-6 py-4 font-black"
								>{t({ locale: $localeStore, key: 'portfolio.trades.col.type' })}</th
							>
							<th class="px-6 py-4 text-right font-black"
								>{t({ locale: $localeStore, key: 'portfolio.trades.col.price' })}</th
							>
							<th class="px-6 py-4 text-right font-black"
								>{t({ locale: $localeStore, key: 'portfolio.trades.col.qty' })}</th
							>
						</tr>
					</thead>
					<tbody class="divide-border divide-y">
						{#each events as event (event.event_id)}
							{@const market = getMarketById(event.series_id)}

							<tr class="group hover:bg-foreground/5 transition-colors">
								<td class="text-muted-foreground px-6 py-4 text-[10px]">
									{formatNanosecondsToDate({ nanoseconds: event.timestamp })}
								</td>
								<td class="min-w-0 px-6 py-4">
									<div class="flex min-w-0 flex-col">
										<span class="text-foreground block truncate text-sm font-bold">
											{market?.title ??
												t({ locale: $localeStore, key: 'portfolio.unknown_market' })}
										</span>
									</div>
								</td>
								<td class="px-6 py-4">
									<span class="text-muted-foreground text-[10px] font-bold uppercase">
										{Object.keys(event.event_type)[0]}
									</span>
								</td>
								<td class="text-foreground px-6 py-4 text-right text-sm font-bold">
									{formatPrice(event.price)}
								</td>
								<td class="text-foreground px-6 py-4 text-right text-sm font-bold">
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
