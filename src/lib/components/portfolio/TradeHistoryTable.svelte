<script lang="ts">
	import type { ClearingDid } from '$declarations';
	import Card from '$lib/components/ui/Card.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import {
		PORTFOLIO_DEFAULT_DECIMALS,
		PORTFOLIO_PAGE_SIZE
	} from '$lib/constants/portfolio.constants';
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

	let page = $state(1);

	$effect(() => {
		const totalPages = Math.max(1, Math.ceil(events.length / PORTFOLIO_PAGE_SIZE));

		if (page > totalPages) {
			page = totalPages;
		}
	});

	const pagedEvents = $derived(
		events.slice((page - 1) * PORTFOLIO_PAGE_SIZE, page * PORTFOLIO_PAGE_SIZE)
	);
</script>

<div class="space-y-4">
	<h2 class="text-foreground text-xl font-bold tracking-wider uppercase">
		{t({ locale: $localeStore, key: 'portfolio.trades.title' })}
	</h2>
	<Card class="overflow-hidden" padding="none">
		{#if events.length === 0}
			<EmptyState message={t({ locale: $localeStore, key: 'portfolio.trades.empty' })} />
		{:else}
			<!-- Mobile: stacked card list -->
			<ul class="divide-border block divide-y md:hidden">
				{#each pagedEvents as event (event.event_id)}
					{@const market = getMarketById(event.series_id)}
					{@const [eventType] = Object.keys(event.event_type)}

					<li class="px-4 py-4">
						<div class="flex items-start justify-between gap-2">
							<p class="text-foreground line-clamp-2 text-sm leading-snug font-bold">
								{market?.title ?? t({ locale: $localeStore, key: 'portfolio.unknown_market' })}
							</p>
							<span
								class="border-border bg-foreground/5 text-muted-foreground shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-black tracking-tight uppercase"
							>
								{eventType}
							</span>
						</div>
						<p class="text-muted-foreground mt-1 text-[10px] tracking-widest uppercase">
							{formatNanosecondsToDate({ nanoseconds: event.timestamp })}
						</p>

						<dl class="border-border mt-3 grid grid-cols-2 gap-2 border-t pt-3">
							<div>
								<dt class="text-muted-foreground text-[9px] font-bold tracking-widest uppercase">
									{t({ locale: $localeStore, key: 'portfolio.trades.col.price' })}
								</dt>
								<dd class="text-foreground mt-1 font-mono text-sm font-bold tabular-nums">
									{formatPrice(event.price)}
								</dd>
							</div>
							<div class="text-right">
								<dt class="text-muted-foreground text-[9px] font-bold tracking-widest uppercase">
									{t({ locale: $localeStore, key: 'portfolio.trades.col.qty' })}
								</dt>
								<dd class="text-foreground mt-1 font-mono text-sm font-bold tabular-nums">
									{formatQuantity({
										value: event.qty,
										decimals: market?.token.decimals ?? PORTFOLIO_DEFAULT_DECIMALS
									})}
								</dd>
							</div>
						</dl>
					</li>
				{/each}
			</ul>

			<!-- Desktop: full table -->
			<div class="hidden w-full min-w-0 overflow-x-auto md:flex">
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
						{#each pagedEvents as event (event.event_id)}
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

			<Pagination
				onPageChange={(p) => (page = p)}
				{page}
				pageSize={PORTFOLIO_PAGE_SIZE}
				totalItems={events.length}
			/>
		{/if}
	</Card>
</div>
