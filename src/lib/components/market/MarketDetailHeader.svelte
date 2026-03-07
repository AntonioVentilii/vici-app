<script lang="ts">
	import OutcomeBadge from '$lib/components/market/OutcomeBadge.svelte';
	import type { Market } from '$lib/types/market';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	const { title, id, status } = $derived(market);
</script>

<div class="space-y-2">
	<div class="flex flex-wrap items-center gap-3">
		<OutcomeBadge {status} />
		<span class="text-xs font-medium text-slate-500">
			ID: <span class="font-mono text-slate-400">{id}</span>
		</span>
	</div>
	<h1 class="text-3xl font-black text-slate-950 sm:text-4xl lg:text-5xl">
		{title}
	</h1>
</div>
