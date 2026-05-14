<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import MarketForkModal from '$lib/components/market/MarketForkModal.svelte';
	import OutcomeBadge from '$lib/components/market/OutcomeBadge.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import PrincipalText from '$lib/components/ui/PrincipalText.svelte';
	import type { Market } from '$lib/types/market';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();
	let isForkModalOpen = $state(false);

	const { title, status, outcome } = $derived(market);
	const isFork = $derived(market.forkedFrom !== undefined);
	const isResolved = $derived(status === 'Resolved');
</script>

<div class="flex flex-col items-center space-y-6 text-center">
	<div class="bg-card flex h-16 w-16 items-center justify-center rounded-2xl p-4 shadow-sm">
		<OutcomeBadge {status} />
	</div>

	{#if isResolved && nonNullish(outcome)}
		<div class="-mt-2">
			<OutcomeBadge {outcome} />
		</div>
	{/if}

	<div class="space-y-4">
		<h1 class="text-foreground max-w-4xl text-3xl font-black sm:text-5xl lg:text-5xl">
			{title}
		</h1>

		{#if market.description}
			<p class="text-muted-foreground mx-auto max-w-2xl text-sm leading-relaxed sm:text-lg">
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
			<span class="text-muted-foreground inline-flex items-center gap-1 text-[10px] font-bold">
				Created by <PrincipalText principal={market.creator} splitLength={5} />
			</span>
		</div>

		{#if !isFork}
			<div class="pt-2">
				<Button onclick={() => (isForkModalOpen = true)} size="sm" variant="outline">
					Challenge Friends
				</Button>
			</div>
		{/if}
	</div>
</div>

{#if !isFork}
	<MarketForkModal isOpen={isForkModalOpen} {market} onClose={() => (isForkModalOpen = false)} />
{/if}
