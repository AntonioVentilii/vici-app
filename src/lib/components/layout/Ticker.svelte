<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface TickerItem {
		label: string;
		consensus: string;
	}

	const items: readonly TickerItem[] = [
		{ label: 'Fed cuts in June?', consensus: '62%' },
		{ label: 'BTC above $120k by July?', consensus: '41%' },
		{ label: 'UK election turnout > 65%?', consensus: '58%' },
		{ label: 'Apple ships foldable in 2026?', consensus: '19%' },
		{ label: 'Oil below $70 this quarter?', consensus: '47%' }
	];

	const track = $derived([...items, ...items]);
</script>

<div class="market-ticker" aria-hidden="true">
	<div class="market-ticker-track">
		{#each track as item, index (index)}
			<span class="market-ticker-item">
				<span class="market-ticker-label">{item.label}</span>
				<span class="market-ticker-meta num">
					{item.consensus}
					{t({ locale: $localeStore, key: 'ticker.consensus' })}
				</span>
			</span>
		{/each}
	</div>
</div>

<style lang="postcss">
	.market-ticker {
		height: var(--ticker-h);
		overflow: hidden;
		border-block: 1px solid var(--border-base);
		background: color-mix(in srgb, var(--parchment) 2%, transparent);
	}

	.market-ticker-track {
		display: flex;
		gap: 3rem;
		height: 100%;
		align-items: center;
		white-space: nowrap;
		animation: market-ticker-scroll 90s linear infinite;
	}

	.market-ticker-item {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--t-12);
		color: var(--parchment-mute);
	}

	.market-ticker-label {
		color: var(--parchment);
		font-weight: 500;
	}

	.market-ticker-meta {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: var(--t-10);
		color: var(--laurel);
	}

	@keyframes market-ticker-scroll {
		to {
			transform: translateX(-50%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.market-ticker-track {
			animation: none;
		}
	}
</style>
