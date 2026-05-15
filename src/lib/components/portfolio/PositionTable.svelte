<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import {
		PORTFOLIO_DEFAULT_DECIMALS,
		PORTFOLIO_DEFAULT_SYMBOL
	} from '$lib/constants/portfolio.constants';
	import { playgroundVxpUnitMode } from '$lib/derived/playground.derived';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
	import { formatCurrency, formatQuantity } from '$lib/utils/format.utils';
	import { formatPositionPnLWithOptionalUnit } from '$lib/utils/playground-display.utils';
	import { calculatePositionPnL, calculatePositionValue } from '$lib/utils/portfolio.utils';

	interface Props {
		positions: Position[];
		markets: Market[];
	}

	const { positions, markets }: Props = $props();

	const getMarketById = (id: string) => markets.find((m) => m.id === id);
</script>

<div class="space-y-4">
	<h2 class="font-display text-foreground text-xl font-semibold tracking-wider uppercase">
		Active Positions
	</h2>
	<Card class="overflow-hidden" padding="none">
		{#if positions.length === 0}
			<EmptyState message="You haven't placed any predictions yet.">
				<a
					class="bg-primary text-primary-foreground hover:bg-primary/90 inline-block rounded-[4px] px-6 py-2.5 text-sm font-bold transition-all active:scale-[0.985]"
					href="/"
				>
					Explore Markets
				</a>
			</EmptyState>
		{:else}
			<div class="flex w-full min-w-0 overflow-x-auto">
				<table class="w-full min-w-0 table-fixed text-left">
					<thead>
						<tr
							class="border-border text-muted-foreground bg-card border-b text-[10px] tracking-widest uppercase"
						>
							<th class="px-6 py-4 font-black">Market</th>
							<th class="px-6 py-4 font-black">Side</th>
							<th class="px-6 py-4 text-right font-black">Size</th>
							<th class="px-6 py-4 text-right font-black">Value</th>
							<th class="px-6 py-4 text-right font-black">P&L</th>
						</tr>
					</thead>
					<tbody class="divide-border divide-y">
						{#each positions as pos, index (index)}
							{@const market = getMarketById(pos.marketId)}
							{@const pnl = calculatePositionPnL({ position: pos, market })}

							<tr class="group hover:bg-card transition-colors">
								<td class="min-w-0 px-6 py-4">
									<a class="group block min-w-0" href="/(app)/markets/{pos.marketId}">
										<span
											class="text-foreground group-hover:text-primary block truncate text-sm font-bold transition-colors"
										>
											{market?.title ?? 'Unknown Market'}
										</span>
										<span
											class="text-muted-foreground block truncate text-[10px] leading-none tracking-widest uppercase"
										>
											ID: {pos.marketId}
										</span>
									</a>
								</td>
								<td class="px-6 py-4">
									<div class="flex gap-1.5">
										<span
											class="rounded-md border px-1.5 py-0.5 text-[10px] font-black tracking-tight uppercase {pos.outcomeId ===
											'YES'
												? 'border-yes/30 bg-yes-wash text-yes'
												: pos.outcomeId === 'NO'
													? 'border-no/30 bg-no-wash text-no'
													: 'border-hold/30 bg-hold-wash text-hold'}"
										>
											{market?.outcomes?.find((o) => o.id === pos.outcomeId)?.title ??
												pos.outcomeId}
										</span>
									</div>
								</td>
								<td
									class="text-foreground px-6 py-4 text-right font-mono text-sm font-bold tabular-nums"
								>
									{formatQuantity({
										value: pos.netQty < ZERO ? -pos.netQty : pos.netQty,
										decimals: market?.token.decimals ?? PORTFOLIO_DEFAULT_DECIMALS
									})}
									<span class="text-muted-foreground text-[10px]">QTY</span>
								</td>
								<td
									class="text-foreground px-6 py-4 text-right font-mono text-sm font-bold tabular-nums"
								>
									{formatCurrency({
										value: calculatePositionValue({ position: pos, market }),
										decimals: market?.token.decimals ?? PORTFOLIO_DEFAULT_DECIMALS,
										symbol: market?.token.symbol ?? PORTFOLIO_DEFAULT_SYMBOL
									})}
								</td>
								<td class="px-6 py-4 text-right">
									<span
										class="font-mono text-sm font-black tabular-nums {pnl >= 0
											? 'text-yes'
											: 'text-no'}"
									>
										{formatPositionPnLWithOptionalUnit({ pnl, playground: $playgroundVxpUnitMode })}
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
