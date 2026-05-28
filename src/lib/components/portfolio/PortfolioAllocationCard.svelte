<script lang="ts">
	import { USD_DECIMALS } from '$lib/constants/app.constants';
	import {
		isMarketTag,
		MARKET_TAG_LABEL_KEYS,
		primaryMarketTag,
		type MarketTag
	} from '$lib/constants/market-tags.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
	import { decimalFixedValueToNumber } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { tagColor } from '$lib/utils/tag-color.utils';

	/**
	 * Portfolio · Allocation
	 *
	 * Groups the user's open VXP positions by primary market tag, sums
	 * `lockedCollateral` per bucket, and renders the top 5 + "Other"
	 * as horizontal progress bars tinted with the per-tag accent.
	 *
	 * The caller hides this card when the user has no open VXP positions;
	 * this component does not render anything in that case either, so it
	 * is safe to mount unconditionally.
	 */
	interface Props {
		positions: Position[];
		markets: Market[];
		marketTags: Record<string, readonly MarketTag[]>;
	}

	const TOP_N = 5;

	// Neutral colour for the synthetic "Other" bucket so it never collides
	// with a real tag accent (notably `wc` and the `tagColor` default both
	// resolve to `#E2B842`).
	const OTHER_COLOR = 'var(--text-muted)';

	const { positions, markets, marketTags }: Props = $props();

	const getMarketById = (id: string) => markets.find((m) => m.id === id);

	const buckets = $derived.by((): { tag: string; share: number; color: string }[] => {
		const byTag: Record<string, number> = {};
		let total = 0;

		for (const pos of positions) {
			const market = getMarketById(pos.marketId);

			if (market !== undefined && market.token.symbol === VXP_TOKEN.symbol) {
				const cost = decimalFixedValueToNumber({
					value: pos.lockedCollateral,
					decimals: USD_DECIMALS
				});

				if (cost > 0) {
					const tag = primaryMarketTag(marketTags[pos.marketId]) ?? 'other';

					byTag[tag] = (byTag[tag] ?? 0) + cost;
					total += cost;
				}
			}
		}

		if (total === 0) {
			return [];
		}

		const sorted = Object.entries(byTag).sort(([, a], [, b]) => b - a);
		const head = sorted.slice(0, TOP_N);
		const tail = sorted.slice(TOP_N);

		const rows = head.map(([tag, value]) => ({
			tag,
			share: value / total,
			color: tagColor(tag)
		}));

		if (tail.length > 0) {
			const otherTotal = tail.reduce((sum, [, v]) => sum + v, 0);

			rows.push({
				tag: 'other',
				share: otherTotal / total,
				color: OTHER_COLOR
			});
		}

		return rows;
	});

	const tagLabel = (tag: string): string => {
		if (isMarketTag(tag)) {
			return t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[tag] });
		}

		return t({ locale: $localeStore, key: 'portfolio.allocation.other' });
	};
</script>

{#if buckets.length > 0}
	<section class="allocation-card">
		<p class="eyebrow allocation-eyebrow">
			{t({ locale: $localeStore, key: 'portfolio.allocation.eyebrow' })}
		</p>

		<ul class="allocation-list">
			{#each buckets as bucket (bucket.tag)}
				{@const pct = Math.round(bucket.share * 100)}
				<li class="allocation-row">
					<div class="allocation-row-head">
						<span class="allocation-row-name">{tagLabel(bucket.tag)}</span>
						<span class="num allocation-row-pct">{pct}%</span>
					</div>
					<div class="allocation-bar">
						<span
							style:width="{bucket.share * 100}%"
							style:background={bucket.color}
							class="allocation-bar-fill"
						></span>
					</div>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style lang="postcss">
	.allocation-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--bg-popover);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.allocation-eyebrow {
		margin: 0;
		color: var(--text-muted);
	}

	.allocation-list {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.allocation-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.allocation-row-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.allocation-row-name {
		font-size: var(--t-13);
		font-weight: 600;
		text-transform: capitalize;
		color: var(--text-base);
	}

	.allocation-row-pct {
		font-size: var(--text-eyebrow, 11px);
		color: var(--text-muted);
	}

	.allocation-bar {
		height: 4px;
		border-radius: 999px;
		background: rgba(242, 236, 220, 0.06);
		overflow: hidden;
	}

	.allocation-bar-fill {
		display: block;
		height: 100%;
		border-radius: 999px;
	}
</style>
