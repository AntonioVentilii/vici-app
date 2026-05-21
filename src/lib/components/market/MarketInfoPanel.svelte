<script lang="ts">
	import MarketRecentTrades from '$lib/components/market/MarketRecentTrades.svelte';
	import ProbabilityChart from '$lib/components/market/ProbabilityChart.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import { formatCurrency } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { getTimeRemaining } from '$lib/utils/market.utils';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	let selectedTab = $state<'Odds' | 'History' | 'Rules'>('Odds');

	const timeRemaining = $derived(getTimeRemaining(market.expiryDate));

	const infoTabs = $derived([
		{ id: 'Odds' as const, label: t({ locale: $localeStore, key: 'market.info.tab.odds' }) },
		{ id: 'History' as const, label: t({ locale: $localeStore, key: 'market.info.tab.history' }) },
		{ id: 'Rules' as const, label: t({ locale: $localeStore, key: 'market.info.tab.resolution' }) }
	]);
</script>

<div class="info-panel">
	<div class="info-tabs">
		{#each infoTabs as tab (tab.id)}
			<button
				class="info-tab {selectedTab === tab.id ? 'is-active' : ''}"
				onclick={() => (selectedTab = tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<div class="info-body">
		{#if selectedTab === 'Odds'}
			<div class="info-stack">
				<div class="info-countdown">
					<span class="allcaps"
						>{t({ locale: $localeStore, key: 'market.info.trading_ends_in' })}</span
					>
					<div class="num">{timeRemaining}</div>
				</div>

				<ProbabilityChart />

				<div class="info-metrics">
					<div>
						<span class="allcaps">{t({ locale: $localeStore, key: 'market.info.total_pool' })}</span
						>
						<strong class="num">
							{formatCurrency({ value: market.totalVolume, decimals: market.token.decimals })}
							<span>{market.token.symbol}</span>
						</strong>
					</div>

					<div>
						<span class="allcaps"
							>{t({ locale: $localeStore, key: 'market.info.total_predictions' })}</span
						>
						<strong class="num">
							{market.outcomes?.reduce((acc, o) => acc + (o.totalPredictions ?? 0), 0) ?? 0}
						</strong>
					</div>
				</div>
			</div>
		{:else if selectedTab === 'History'}
			<div class="info-history">
				<MarketRecentTrades isEmbedded={true} marketId={market.id} />
			</div>
		{:else}
			<div class="info-stack">
				<div class="info-resolution">
					<p class="eyebrow">{t({ locale: $localeStore, key: 'market.info.official_criteria' })}</p>
					<p>
						{market.description || t({ locale: $localeStore, key: 'market.info.verified_default' })}
					</p>
				</div>

				<div class="info-note">
					<span aria-hidden="true">●</span>
					<div>
						<h5>{t({ locale: $localeStore, key: 'market.info.settlement_rule' })}</h5>
						<p>
							{t({ locale: $localeStore, key: 'market.info.settlement_body' })}
						</p>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style lang="postcss">
	.info-panel {
		overflow: hidden;
		border: 1px solid var(--border-base);
		border-radius: 1.5rem;
		background: linear-gradient(180deg, var(--bg-popover), var(--bg-surface));
		box-shadow: var(--shadow-card);
	}

	.info-tabs {
		display: flex;
		gap: 0.25rem;
		border-bottom: 1px solid var(--border-base);
		background: color-mix(in srgb, var(--bg-surface) 80%, transparent);
		padding: 0.35rem;
	}

	.info-tab {
		flex: 1;
		border-radius: var(--r-8);
		padding: 0.65rem 0.5rem;
		color: var(--text-muted);
		font-size: var(--t-12);
		font-weight: 800;
		transition:
			background-color var(--d-state) var(--ease-vici),
			color var(--d-state) var(--ease-vici);
	}

	.info-tab.is-active {
		background: var(--bg-popover);
		color: var(--laurel);
		box-shadow: var(--inset-hi);
	}

	.info-body {
		min-height: 24rem;
		padding: 1rem;
	}

	.info-stack {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.info-countdown,
	.info-resolution,
	.info-note,
	.info-metrics > div {
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		box-shadow: var(--inset-hi);
	}

	.info-countdown {
		padding: 1rem;
		text-align: center;
	}

	.info-countdown .num {
		margin-top: 0.25rem;
		color: var(--laurel);
		font-size: var(--t-24);
		font-weight: 800;
	}

	.info-metrics {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.5rem;
	}

	.info-metrics > div {
		padding: 0.85rem;
	}

	.info-metrics strong {
		display: block;
		margin-top: 0.25rem;
		color: var(--text-base);
		font-size: var(--t-14);
	}

	.info-metrics strong span {
		margin-left: 0.25rem;
		color: var(--text-muted);
		font-size: var(--t-12);
	}

	.info-history {
		margin: -1rem;
	}

	.info-resolution {
		padding: 1rem;
	}

	.info-resolution p {
		margin: 0;
	}

	.info-resolution p + p {
		margin-top: 0.5rem;
		color: var(--text-base);
		font-size: var(--t-14);
		line-height: var(--leading-normal);
	}

	.info-note {
		display: flex;
		gap: 0.75rem;
		padding: 1rem;
	}

	.info-note span {
		color: var(--laurel);
	}

	.info-note h5 {
		margin: 0;
		color: var(--laurel);
		font-size: var(--t-12);
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: var(--tracking-allcaps);
	}

	.info-note p {
		margin: 0.35rem 0 0;
		color: var(--text-muted);
		font-size: var(--t-12);
		line-height: var(--leading-normal);
	}
</style>
