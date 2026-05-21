<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		totalHoldings: string;
		totalPnL: string;
		activeMarketsCount: number;
		openOrdersCount: number;
		tradeHistoryCount: number;
		pnlVariant: 'success' | 'warning' | 'default';
	}

	const {
		totalHoldings,
		totalPnL,
		activeMarketsCount,
		openOrdersCount,
		tradeHistoryCount,
		pnlVariant
	}: Props = $props();

	const pnlToneClass = $derived(
		pnlVariant === 'success' ? 'text-yes' : pnlVariant === 'warning' ? 'text-no' : 'text-foreground'
	);

	const activityTiles = $derived([
		{
			label: t({ locale: $localeStore, key: 'portfolio.stats.positions' }),
			value: activeMarketsCount
		},
		{
			label: t({ locale: $localeStore, key: 'portfolio.stats.orders' }),
			value: openOrdersCount
		},
		{
			label: t({ locale: $localeStore, key: 'portfolio.stats.history' }),
			value: tradeHistoryCount
		}
	]);

	const activityMax = $derived(Math.max(1, activeMarketsCount, openOrdersCount, tradeHistoryCount));
</script>

<section
	class="border-border bg-card shadow-card relative overflow-hidden rounded-[2rem] border p-5 md:p-8"
>
	<div
		class="from-primary/12 pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b to-transparent"
	></div>

	<div class="relative grid gap-6 lg:grid-cols-[1.2fr_0.95fr] lg:items-end">
		<div class="space-y-5">
			<p class="text-primary text-xs font-black tracking-[0.16em] uppercase">
				{t({ locale: $localeStore, key: 'portfolio.stats.eyebrow' })}
			</p>
			<div class="flex flex-wrap items-end gap-x-3 gap-y-1">
				<h2
					class="text-foreground font-mono text-4xl font-black tracking-tight tabular-nums md:text-6xl"
				>
					{totalHoldings}
				</h2>
			</div>
			<p class="text-muted-foreground max-w-xl text-sm leading-relaxed">
				{t({ locale: $localeStore, key: 'portfolio.stats.sub' })}
			</p>

			<div class="grid max-w-xl grid-cols-3 gap-2">
				{#each activityTiles as tile (tile.label)}
					<div class="border-border bg-background/35 rounded-2xl border p-3">
						<div class="bg-foreground/5 mb-3 h-1.5 overflow-hidden rounded-full">
							<div
								style="width: {(tile.value / activityMax) * 100}%"
								class="bg-primary h-full rounded-full"
							></div>
						</div>
						<p class="text-foreground font-mono text-lg font-black tabular-nums">
							{tile.value}
						</p>
						<p class="text-muted-foreground mt-1 text-[9px] font-bold tracking-widest uppercase">
							{tile.label}
						</p>
					</div>
				{/each}
			</div>
		</div>

		<div class="border-border bg-background/45 rounded-2xl border p-5">
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
						{t({ locale: $localeStore, key: 'portfolio.stats.pnl' })}
					</p>
					<p class={['mt-3 font-mono text-3xl font-black tabular-nums md:text-4xl', pnlToneClass]}>
						{totalPnL}
					</p>
				</div>
				<div
					class={[
						'rounded-full border px-3 py-1.5 font-mono text-[10px] font-black tracking-widest uppercase',
						pnlVariant === 'success'
							? 'border-yes/30 bg-yes-wash text-yes'
							: pnlVariant === 'warning'
								? 'border-no/30 bg-no-wash text-no'
								: 'border-border bg-card text-muted-foreground'
					]}
				>
					{t({ locale: $localeStore, key: 'portfolio.stats.pnl' })}
				</div>
			</div>

			<div class="mt-5 grid grid-cols-12 items-end gap-1.5">
				{#each activityTiles as tile (tile.label)}
					<div
						style="height: {Math.max(12, 26 + (tile.value / activityMax) * 58)}px"
						class="bg-primary/25 rounded-t-sm"
					></div>
					<div class="bg-primary/35 h-9 rounded-t-sm"></div>
					<div class="bg-primary/50 h-14 rounded-t-sm"></div>
					<div class="bg-primary/70 h-11 rounded-t-sm"></div>
				{/each}
			</div>
			<div class="border-border mt-5 border-t pt-4">
				<p class="text-muted-foreground text-xs leading-relaxed">
					{t({ locale: $localeStore, key: 'portfolio.stats.sub' })}
				</p>
			</div>
		</div>
	</div>
</section>
