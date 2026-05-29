<script lang="ts">
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import type { OrderType } from '$lib/types/order';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	interface Props {
		orderType: OrderType;
		hasMarketDepth: boolean;
		onSelect: (type: OrderType) => void;
	}

	let { orderType, hasMarketDepth, onSelect }: Props = $props();

	const tr = ({ key, params }: { key: MessageKey; params?: Record<string, string | number> }) =>
		t({ locale: $localeStore, key, params });
</script>

<div class="prediction-order-toggle">
	<BaseButton
		class="flex-1 rounded-lg py-2 text-xs font-bold {orderType === 'MARKET'
			? 'bg-card text-primary shadow-sm'
			: 'text-muted-foreground hover:text-foreground'}"
		onclick={() => onSelect('MARKET')}
		status={hasMarketDepth ? 'enabled' : 'disabled'}
		title={!hasMarketDepth ? tr({ key: 'prediction.no_liquidity_title' }) : ''}
	>
		{tr({ key: 'prediction.order.instant' })}
	</BaseButton>

	<BaseButton
		class="flex-1 rounded-lg py-2 text-xs font-bold {orderType === 'LIMIT'
			? 'bg-card text-primary shadow-sm'
			: 'text-muted-foreground hover:text-foreground'}"
		onclick={() => onSelect('LIMIT')}
	>
		{tr({ key: 'prediction.order.set_price' })}
	</BaseButton>
</div>

<style lang="postcss">
	.prediction-order-toggle {
		display: flex;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		padding: 0.25rem;
	}
</style>
