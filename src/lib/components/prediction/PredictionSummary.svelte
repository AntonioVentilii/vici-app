<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	interface Props {
		estimatedCost: string;
		estimatedPayout: string;
		potentialReturnPercent: number;
	}

	let { estimatedCost, estimatedPayout, potentialReturnPercent }: Props = $props();

	const tr = ({ key, params }: { key: MessageKey; params?: Record<string, string | number> }) =>
		t({ locale: $localeStore, key, params });
</script>

<div class="bg-foreground/5 space-y-3 rounded-2xl p-5">
	<div class="flex justify-between text-xs">
		<span class="text-muted-foreground font-medium">{tr({ key: 'prediction.estimated_cost' })}</span
		>

		<span class="text-foreground font-bold">{estimatedCost}</span>
	</div>

	<div class="flex justify-between text-xs">
		<span class="text-muted-foreground font-medium"
			>{tr({ key: 'prediction.potential_return' })}</span
		>

		<span class="text-yes font-bold">
			{estimatedPayout} ({potentialReturnPercent.toFixed(1)}%)
		</span>
	</div>
</div>
