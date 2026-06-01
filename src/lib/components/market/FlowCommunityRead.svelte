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
	<!-- The Flow deck sparkline stays on the seed-based shape (no real
	     `points`): the back face is only ever seen after a flip, and a
	     market-wide history fetch per card during a swipe session would turn
	     the deck into N blocking queries. Real market-wide history is wired
	     into the market-detail chart instead, where a single focused fetch
	     is cheap. -->
	<FlowCardSparkline events={metadata?.events} seed={market.id} yesPercent={yesPct} />
</section>

<style lang="postcss">
	.flow-back-block {
		display: flex;
		flex-direction: column;
	}

	/* The community read is bare — number + sparkline sit directly on the
	   card with no surface box; only the resolution / stake / split
	   blocks are framed. */
	.flow-community {
		gap: 0.25rem;
	}

	.flow-community-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.flow-community-pct {
		font-size: 1.625rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.05;
	}
	.flow-community-side {
		margin-left: 2px;
		font-size: var(--t-13);
		font-weight: 600;
		letter-spacing: 0.04em;
	}
	.flow-community-delta {
		font-size: var(--t-12);
		font-weight: 500;
	}
	.flow-delta-yes {
		color: var(--yes);
	}
	.flow-delta-no {
		color: var(--no);
	}
</style>
