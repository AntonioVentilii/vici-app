<script lang="ts">
	import { ZERO } from '$lib/constants/app.constants';
	import {
		MARKET_TAG_LABEL_KEYS,
		primaryMarketTag,
		type MarketTag
	} from '$lib/constants/market-tags.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
	import { t } from '$lib/utils/i18n.utils';
	import { calculatePositionValue } from '$lib/utils/portfolio.utils';
	import { tagColor } from '$lib/utils/tag-color.utils';

	interface Props {
		positions: Position[];
		markets: Market[];
		tagsBySeries: Record<string, MarketTag[]>;
	}

	const { positions, markets, tagsBySeries }: Props = $props();

	// Bucket every open position by primary category tag and roll up the
	// position value. Uses bigint end-to-end (matching `portfolio.utils`)
	// so the math stays correct on positions larger than 2^53 — only
	// step into `Number` at the final percentage conversion. Plain
	// object indexed by MarketTag avoids the Svelte reactivity-Map rule
	// since this accumulator never escapes the deriver.
	const allocation = $derived.by(() => {
		const marketById = Object.fromEntries(markets.map((m) => [m.id, m])) as Record<string, Market>;
		const buckets: Partial<Record<MarketTag, bigint>> = {};
		let total = ZERO;

		for (const pos of positions) {
			const market = marketById[pos.marketId];
			const tag = primaryMarketTag(tagsBySeries[pos.marketId]);

			if (tag !== undefined && market !== undefined) {
				const value = calculatePositionValue({ position: pos, market });

				buckets[tag] = (buckets[tag] ?? ZERO) + value;
				total += value;
			}
		}

		if (total === ZERO) {
			return [];
		}

		// Compute pct with bigint precision (×10_000 then divide back to a
		// number) so the bars sum to ~100 without rounding drift, then
		// sort largest-first so the dominant category sits at the top.
		return (Object.entries(buckets) as Array<[MarketTag, bigint]>)
			.map(([tag, value]) => ({
				tag,
				pct: Number((value * 10_000n) / total) / 100
			}))
			.sort((a, b) => b.pct - a.pct);
	});
</script>

{#if allocation.length > 0}
	<section
		class="surface border-border bg-card flex flex-col gap-3 rounded-2xl border px-5 py-4"
		aria-labelledby="portfolio-allocation-eyebrow"
	>
		<span id="portfolio-allocation-eyebrow" class="allcaps">
			{t({ locale: $localeStore, key: 'portfolio.allocation.eyebrow' })}
		</span>
		<ul class="flex flex-col gap-3">
			{#each allocation as item (item.tag)}
				<li class="flex flex-col gap-1.5">
					<div class="flex items-center justify-between">
						<span class="text-foreground text-sm font-medium">
							{t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[item.tag] })}
						</span>
						<span class="num text-muted-foreground text-xs font-semibold">
							{item.pct.toFixed(0)}%
						</span>
					</div>
					<div class="bg-foreground/8 h-1 overflow-hidden rounded-full">
						<div
							style:background-color={tagColor(item.tag)}
							style:width="{item.pct}%"
							class="h-full rounded-full transition-[width] duration-300 ease-out"
						></div>
					</div>
				</li>
			{/each}
		</ul>
	</section>
{/if}
