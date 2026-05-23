<script lang="ts">
	import PositionArtThumb from '$lib/components/portfolio/PositionArtThumb.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import {
		PORTFOLIO_DEFAULT_DECIMALS,
		PORTFOLIO_DEFAULT_SYMBOL,
		PORTFOLIO_PAGE_SIZE
	} from '$lib/constants/portfolio.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { playgroundVxpUnitMode } from '$lib/derived/playground.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import type { SeriesCategory } from '$lib/types/category';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
	import { formatCurrency, formatQuantity } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { formatPositionPnLWithOptionalUnit } from '$lib/utils/playground-display.utils';
	import { calculatePositionPnL, calculatePositionValue } from '$lib/utils/portfolio.utils';
	import { positionResolvedResult } from '$lib/utils/position.utils';

	interface Props {
		positions: Position[];
		markets: Market[];
		// Optional admin-tagged category mappings. When provided, each
		// thumb resolves its visual language from the matching
		// `SeriesCategory.categoryId`; otherwise it falls back to a
		// deterministic hash of the market id.
		categoryMappings?: SeriesCategory[];
	}

	const { positions, markets, categoryMappings = [] }: Props = $props();

	const getMarketById = (id: string) => markets.find((m) => m.id === id);
	const getCategoryId = (marketId: string): string | null =>
		categoryMappings.find((c) => c.seriesId === marketId)?.categoryId ?? null;

	let page = $state(1);

	// Clamp the active page when the dataset shrinks (e.g. after a
	// settlement or refresh). Runs as an effect rather than derived so we
	// only adjust on real shrinks, not on the first render.
	$effect(() => {
		const totalPages = Math.max(1, Math.ceil(positions.length / PORTFOLIO_PAGE_SIZE));

		if (page > totalPages) {
			page = totalPages;
		}
	});

	const pagedPositions = $derived(
		positions.slice((page - 1) * PORTFOLIO_PAGE_SIZE, page * PORTFOLIO_PAGE_SIZE)
	);
</script>

<div class="space-y-4">
	<h2 class="font-display text-foreground text-xl font-semibold tracking-wider uppercase">
		{t({ locale: $localeStore, key: 'portfolio.positions.title' })}
	</h2>
	<Card class="overflow-hidden" padding="none">
		{#if positions.length === 0}
			<EmptyState message={t({ locale: $localeStore, key: 'portfolio.positions.empty' })}>
				<a
					class="bg-primary text-primary-foreground hover:bg-primary/90 inline-block rounded-[4px] px-6 py-2.5 text-sm font-bold transition-all active:scale-[0.985]"
					href="/"
				>
					{t({ locale: $localeStore, key: 'portfolio.positions.explore_markets' })}
				</a>
			</EmptyState>
		{:else}
			<!-- Mobile: stacked card list. The desktop table loses too
				 much per-row text to truncation below ~720px, so we
				 swap layouts entirely instead of compressing columns. -->
			<ul class="divide-border block w-full min-w-0 divide-y md:hidden">
				{#each pagedPositions as pos (`${pos.marketId}::${pos.outcomeId}`)}
					{@const market = getMarketById(pos.marketId)}
					{@const pnl = calculatePositionPnL({ position: pos, market })}
					{@const result = market
						? (positionResolvedResult({ market, position: pos }) ?? 'neutral')
						: 'neutral'}
					{@const categoryId = getCategoryId(pos.marketId)}

					<li>
						<a
							class="hover:bg-card block px-4 py-4 transition-colors"
							href="{AppPath.Markets}/{pos.marketId}"
						>
							<div class="flex items-start gap-3">
								<PositionArtThumb {categoryId} marketId={pos.marketId} {result} size={48} />
								<div class="flex min-w-0 flex-1 items-start justify-between gap-2">
									<div class="min-w-0">
										<p class="text-foreground line-clamp-2 text-sm leading-snug font-bold">
											{market?.title ??
												t({ locale: $localeStore, key: 'portfolio.unknown_market' })}
										</p>
										<p
											class="text-muted-foreground mt-1 truncate text-[10px] tracking-widest uppercase"
										>
											{t({
												locale: $localeStore,
												key: 'portfolio.id_label',
												params: { id: pos.marketId }
											})}
										</p>
									</div>
									<span
										class="shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-black tracking-tight uppercase {pos.outcomeId ===
										'YES'
											? 'border-yes/30 bg-yes-wash text-yes'
											: pos.outcomeId === 'NO'
												? 'border-no/30 bg-no-wash text-no'
												: 'border-hold/30 bg-hold-wash text-hold'}"
									>
										{market?.outcomes?.find((o) => o.id === pos.outcomeId)?.title ?? pos.outcomeId}
									</span>
								</div>
							</div>

							<dl class="border-border mt-3 grid grid-cols-3 gap-2 border-t pt-3">
								<div>
									<dt class="text-muted-foreground text-[9px] font-bold tracking-widest uppercase">
										{t({ locale: $localeStore, key: 'portfolio.positions.col.size' })}
									</dt>
									<dd class="text-foreground mt-1 font-mono text-sm font-bold tabular-nums">
										{formatQuantity({
											value: pos.netQty < ZERO ? -pos.netQty : pos.netQty,
											decimals: market?.token.decimals ?? PORTFOLIO_DEFAULT_DECIMALS
										})}
										<span class="text-muted-foreground text-[9px]"
											>{t({ locale: $localeStore, key: 'portfolio.qty_unit' })}</span
										>
									</dd>
								</div>
								<div>
									<dt class="text-muted-foreground text-[9px] font-bold tracking-widest uppercase">
										{t({ locale: $localeStore, key: 'portfolio.positions.col.value' })}
									</dt>
									<dd class="text-foreground mt-1 font-mono text-sm font-bold tabular-nums">
										{formatCurrency({
											value: calculatePositionValue({ position: pos, market }),
											decimals: market?.token.decimals ?? PORTFOLIO_DEFAULT_DECIMALS,
											symbol: market?.token.symbol ?? PORTFOLIO_DEFAULT_SYMBOL
										})}
									</dd>
								</div>
								<div class="text-right">
									<dt class="text-muted-foreground text-[9px] font-bold tracking-widest uppercase">
										{t({ locale: $localeStore, key: 'portfolio.positions.col.pnl' })}
									</dt>
									<dd
										class={[
											'mt-1 font-mono text-sm font-black tabular-nums',
											pnl >= 0 ? 'text-yes' : 'text-no'
										].join(' ')}
									>
										{formatPositionPnLWithOptionalUnit({
											pnl,
											playground: $playgroundVxpUnitMode
										})}
									</dd>
								</div>
							</dl>
						</a>
					</li>
				{/each}
			</ul>

			<!-- Desktop: full table -->
			<div class="hidden w-full min-w-0 overflow-x-auto md:flex">
				<table class="w-full min-w-0 table-fixed text-left">
					<thead>
						<tr
							class="border-border text-muted-foreground bg-card border-b text-[10px] tracking-widest uppercase"
						>
							<th class="w-[40%] px-6 py-4 font-black"
								>{t({ locale: $localeStore, key: 'portfolio.positions.col.market' })}</th
							>
							<th class="w-[10%] px-6 py-4 font-black"
								>{t({ locale: $localeStore, key: 'portfolio.positions.col.side' })}</th
							>
							<th class="w-[15%] px-6 py-4 text-right font-black"
								>{t({ locale: $localeStore, key: 'portfolio.positions.col.size' })}</th
							>
							<th class="w-[17%] px-6 py-4 text-right font-black"
								>{t({ locale: $localeStore, key: 'portfolio.positions.col.value' })}</th
							>
							<th class="w-[18%] px-6 py-4 text-right font-black"
								>{t({ locale: $localeStore, key: 'portfolio.positions.col.pnl' })}</th
							>
						</tr>
					</thead>
					<tbody class="divide-border divide-y">
						{#each pagedPositions as pos (`${pos.marketId}::${pos.outcomeId}`)}
							{@const market = getMarketById(pos.marketId)}
							{@const pnl = calculatePositionPnL({ position: pos, market })}
							{@const result = market
								? (positionResolvedResult({ market, position: pos }) ?? 'neutral')
								: 'neutral'}
							{@const categoryId = getCategoryId(pos.marketId)}

							<tr class="group hover:bg-card transition-colors">
								<td class="min-w-0 px-6 py-4">
									<a
										class="group flex min-w-0 items-center gap-3"
										href="{AppPath.Markets}/{pos.marketId}"
									>
										<PositionArtThumb {categoryId} marketId={pos.marketId} {result} size={44} />
										<span class="min-w-0 flex-1">
											<span
												class="text-foreground group-hover:text-primary line-clamp-2 block text-sm leading-snug font-bold transition-colors"
											>
												{market?.title ??
													t({ locale: $localeStore, key: 'portfolio.unknown_market' })}
											</span>
											<span
												class="text-muted-foreground mt-1 block truncate text-[10px] leading-none tracking-widest uppercase"
											>
												{t({
													locale: $localeStore,
													key: 'portfolio.id_label',
													params: { id: pos.marketId }
												})}
											</span>
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
									<span class="text-muted-foreground text-[10px]"
										>{t({ locale: $localeStore, key: 'portfolio.qty_unit' })}</span
									>
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

			<Pagination
				onPageChange={(p) => (page = p)}
				{page}
				pageSize={PORTFOLIO_PAGE_SIZE}
				totalItems={positions.length}
			/>
		{/if}
	</Card>
</div>
