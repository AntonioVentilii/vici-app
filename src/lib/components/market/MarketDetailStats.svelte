<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import { formatDate, formatVolume } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { getTimeRemaining } from '$lib/utils/market.utils';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	const {
		totalVolume,
		expiryDate,
		token: { symbol: tokenSymbol, decimals: tokenDecimals }
	} = $derived(market);

	const timeRemaining = $derived(getTimeRemaining(market.expiryDate));
</script>

<div class="detail-stats">
	<div class="detail-stat">
		<span class="allcaps"
			>{t({ locale: $localeStore, key: 'market.detail.stats.total_volume' })}</span
		>
		<div class="detail-stat-value">
			<span class="num">
				{formatVolume({ volume: totalVolume, decimals: tokenDecimals, symbol: '' })}
			</span>
			<span>{tokenSymbol}</span>
		</div>
	</div>
	<div class="detail-stat">
		<span class="allcaps"
			>{t({ locale: $localeStore, key: 'market.detail.stats.expiry_date' })}</span
		>
		<strong>{formatDate(expiryDate)}</strong>
	</div>
	<div class="detail-stat">
		<span class="allcaps"
			>{t({ locale: $localeStore, key: 'market.detail.stats.time_remaining' })}</span
		>
		<strong class="text-primary">{timeRemaining}</strong>
	</div>
</div>

<style lang="postcss">
	.detail-stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.detail-stat {
		min-width: 0;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		box-shadow: var(--inset-hi);
		padding: 0.75rem;
	}

	.detail-stat-value {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
		margin-top: 0.3rem;
	}

	.detail-stat-value .num,
	.detail-stat strong {
		display: block;
		overflow: hidden;
		color: var(--text-base);
		font-size: var(--t-14);
		font-weight: 800;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.detail-stat-value span:last-child {
		color: var(--text-muted);
		font-size: var(--t-12);
		font-weight: 700;
	}

	@media (min-width: 1024px) {
		.detail-stats {
			grid-template-columns: 1fr;
		}
	}
</style>
