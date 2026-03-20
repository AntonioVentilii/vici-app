<script lang="ts">
	import OutcomeBadge from '$lib/components/market/OutcomeBadge.svelte';
	import type { Market } from '$lib/types/market';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	const { title, status } = $derived(market);
</script>

<div class="flex flex-col items-center space-y-6 text-center">
	<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 p-4 shadow-sm">
		<OutcomeBadge {status} />
	</div>

	<div class="space-y-4">
		<h1 class="max-w-4xl text-3xl font-black text-slate-950 sm:text-5xl lg:text-5xl">
			{title}
		</h1>

		{#if market.description}
			<p class="mx-auto max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-lg">
				{market.description}
			</p>
		{/if}

		<div class="flex items-center justify-center gap-2">
			<span
				class="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500 uppercase"
				>Memes</span
			>
			<span class="text-[10px] font-bold text-slate-400"
				>Created by {market.creator.substring(0, 5)}...{market.creator.substring(
					market.creator.length - 3
				)}</span
			>
		</div>
	</div>
</div>
