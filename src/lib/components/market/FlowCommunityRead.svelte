<script lang="ts">
	import FlowCardSparkline from '$lib/components/market/FlowCardSparkline.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import type { CallSide, Market } from '$lib/types/market';
	import type { MarketMetadata } from '$lib/types/market-metadata';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		market: Market;
		metadata?: MarketMetadata;
		// Crowd-side derived state piped down from FlowCard so the front
		// and back read off the same numbers (avoids two `derived`
		// computations diverging on float rounding).
		crowdPct: number;
		crowdSide: CallSide;
	}

	const { market, metadata, crowdPct, crowdSide }: Props = $props();

	const yesPct = $derived(crowdPct);
	const noPct = $derived(100 - yesPct);
	// Headline number must read off `crowdSide` — the majority side the
	// label shows. `crowdPct` is always the YES share, so a NO-leaning
	// market needs `noPct` here or the figure contradicts its own label.
	const crowdSidePct = $derived(crowdSide === 'YES' ? yesPct : noPct);
</script>

<section class="flow-back-block flow-community">
	<div class="flow-community-top">
		<span class={`num flow-community-pct ${crowdSide === 'YES' ? 'text-yes' : 'text-no'}`}>
			{crowdSidePct}%
			<span class="flow-community-side">{crowdSide}</span>
		</span>
		<span class={`flow-community-delta num ${yesPct >= 50 ? 'flow-delta-yes' : 'flow-delta-no'}`}>
			{yesPct >= 50 ? '▲' : '▼'}
			{Math.abs(yesPct - Math.max(5, yesPct - 12))}% {t({
				locale: $localeStore,
				key: 'card.back.this_week'
			})}
		</span>
	</div>
	<FlowCardSparkline events={metadata?.events} seed={market.id} yesPercent={yesPct} />
</section>

<style lang="postcss">
	/* Shared block wrapper + section surface — duplicated here so the
	   extracted section keeps its spacing + surface under Svelte's
	   per-component style scoping. */
	.flow-back-block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.flow-community {
		padding: 0.75rem 0.85rem;
		border-radius: var(--r-12);
		border: 1px solid var(--border-base);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		box-shadow: var(--inset-hi);
	}

	.flow-community-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.flow-community-pct {
		font-size: 2.05rem;
		font-weight: 600;
		letter-spacing: -0.03em;
		line-height: 1;
	}
	.flow-community-side {
		margin-left: 0.35rem;
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
	}
	.flow-community-delta {
		font-size: var(--t-12);
		font-weight: 700;
	}
	.flow-delta-yes {
		color: var(--yes);
	}
	.flow-delta-no {
		color: var(--no);
	}
</style>
