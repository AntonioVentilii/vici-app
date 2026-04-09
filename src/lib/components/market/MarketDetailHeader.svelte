<script lang="ts">
	import MarketForkModal from '$lib/components/market/MarketForkModal.svelte';
	import OutcomeBadge from '$lib/components/market/OutcomeBadge.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { Market } from '$lib/types/market';
	import { shortenWithMiddleEllipsis } from '$lib/utils/format.utils';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();
	let isForkModalOpen = $state(false);

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
				class="border-foreground/25 text-foreground bg-foreground/8 rounded-full border px-3 py-1 text-[10px] font-bold tracking-widest uppercase"
			>
				Memes
			</span>
			{#if market.isInviteOnly}
				<Badge size="sm" variant="warning">Closed Circle</Badge>
			{/if}
			<span class="text-[10px] font-bold text-slate-400">
				Created by {shortenWithMiddleEllipsis({ text: market.creator, splitLength: 5 })}
			</span>
		</div>

		<div class="pt-2">
			<Button onclick={() => (isForkModalOpen = true)} size="sm" variant="outline">
				<span class="mr-2">🤝</span> Challenge Friends
			</Button>
		</div>
	</div>
</div>

<MarketForkModal isOpen={isForkModalOpen} {market} onClose={() => (isForkModalOpen = false)} />
