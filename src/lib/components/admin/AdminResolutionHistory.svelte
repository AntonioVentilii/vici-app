<script lang="ts">
	import OutcomeBadge from '$lib/components/market/OutcomeBadge.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		markets: Market[];
	}

	const { markets }: Props = $props();
</script>

<div class="border-border bg-card rounded-3xl border p-8">
	<h2 class="text-foreground mb-6 text-2xl font-bold">
		{t({ locale: $localeStore, key: 'admin.resolution.history.title' })}
	</h2>
	<div class="space-y-4">
		{#each markets.slice(0, 5) as market (market.id)}
			<div
				class="border-border flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
			>
				<span class="text-muted-foreground line-clamp-1 text-sm">{market.title}</span>
				<OutcomeBadge outcome={market.outcome} />
			</div>
		{/each}
	</div>
</div>
