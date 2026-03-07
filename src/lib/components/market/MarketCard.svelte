<script lang="ts">
	import { Clock } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import type { Market } from '$lib/types/market';
	import { formatProbability } from '$lib/utils/format.utils';
	import { getTimeRemaining, getOutcomeVariant } from '$lib/utils/market.utils';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();
</script>

<Card
	onclick={() => goto(`${AppPath.Markets}/${market.id}`)}
	onkeydown={(e) => e.key === 'Enter' && goto(`${AppPath.Markets}/${market.id}`)}
	padding="lg"
	role="button"
	variant="default"
>
	<div class="flex h-full flex-col gap-4 text-left">
		<div class="flex h-full items-start justify-between gap-4">
			<h3
				class="group-hover:text-primary text-lg leading-tight font-bold text-wrap wrap-break-word transition-colors"
			>
				{market.title}
			</h3>
			<Badge variant={getOutcomeVariant(market.status)}>
				{market.status}
			</Badge>
		</div>

		<p class="text-muted-foreground text-sm text-wrap wrap-break-word">
			{market.description}
		</p>

		<!-- Probabilities Area -->
		<div class="grid grid-cols-2 gap-4">
			<a
				class="rounded-xl bg-emerald-500/10 p-3 text-center transition-all hover:bg-emerald-500/20"
				href="{AppPath.Markets}/{market.id}?side=yes"
				onclick={(e) => e.stopPropagation()}
			>
				<div class="text-[10px] font-bold text-emerald-600 uppercase">Yes</div>
				<div class="text-xl font-black text-emerald-700">
					{formatProbability(market.yesProbability)}
				</div>
			</a>

			<a
				class="bg-destructive/10 hover:bg-destructive/20 rounded-xl p-3 text-center transition-all"
				href="{AppPath.Markets}/{market.id}?side=no"
				onclick={(e) => e.stopPropagation()}
			>
				<div class="text-destructive text-[10px] font-bold uppercase">No</div>
				<div class="text-destructive text-xl font-black">
					{formatProbability(market.noProbability)}
				</div>
			</a>
		</div>

		<!-- Footer Stats -->
		<div class="border-border flex items-center justify-between border-t pt-3">
			<div class="text-muted-foreground flex items-center gap-1.5">
				<Clock size={14} />
				<span class="inline text-xs font-bold">
					{getTimeRemaining(market.expiryDate)}
				</span>
			</div>
		</div>
	</div>
</Card>

<style lang="postcss">
	:global(.group:hover) h3 {
		color: var(--color-primary);
	}
</style>
