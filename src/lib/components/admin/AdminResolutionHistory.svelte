<script lang="ts">
	import OutcomeBadge from '$lib/components/market/OutcomeBadge.svelte';
	import type { Market } from '$lib/types/market';

	interface Props {
		markets: Market[];
	}

	const { markets }: Props = $props();
</script>

<div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
	<h2 class="mb-6 text-2xl font-bold text-slate-950">Recent Resolutions</h2>
	<div class="space-y-4">
		{#each markets.slice(0, 5) as market (market.id)}
			<div
				class="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0"
			>
				<span class="line-clamp-1 text-sm text-slate-600">{market.title}</span>
				<OutcomeBadge outcome={market.outcome} />
			</div>
		{/each}
	</div>
</div>
