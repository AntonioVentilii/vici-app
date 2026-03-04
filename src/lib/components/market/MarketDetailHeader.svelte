<script lang="ts">
	import OutcomeBadge from '$lib/components/market/OutcomeBadge.svelte';
	import type { MarketStatus } from '$lib/types/market';

	interface Props {
		title: string;
		id: string;
		status: MarketStatus;
	}

	const { title, id, status }: Props = $props();
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center gap-4">
		<OutcomeBadge {status} />
		<span class="text-sm font-medium text-slate-500">
			Market ID: <span class="font-mono text-slate-400">{id}</span>
		</span>
	</div>
	<h1 class="text-4xl font-black text-slate-950 sm:text-5xl lg:text-7xl">
		{title}
	</h1>
</div>
