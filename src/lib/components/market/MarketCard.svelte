<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
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
			{#if market.payoffType === 'Binary'}
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
			{:else}
				<div
					class="col-span-2 flex flex-col gap-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100 ring-inset"
				>
					<div class="flex items-center justify-between">
						<div class="text-[10px] font-bold text-slate-400 uppercase">Top Outcomes</div>
						<div class="text-[10px] font-bold text-indigo-500 uppercase">
							{market.outcomes?.length ?? 0} total
						</div>
					</div>

					<div class="flex flex-col gap-2">
						{#each (market.outcomes ?? [])
							// eslint-disable-next-line local-rules/prefer-object-params
							.toSorted((a, b) => (b.probability ?? 0) - (a.probability ?? 0) || a.title.localeCompare(b.title))
							.slice(0, 3) as outcome (outcome.id)}
							<a
								class="group/outcome flex items-center justify-between rounded-xl bg-white p-2.5 ring-1 ring-slate-100 transition-all hover:ring-indigo-200"
								href="{AppPath.Markets}/{market.id}?side={outcome.id}"
								onclick={(e) => e.stopPropagation()}
							>
								<div class="flex flex-1 items-center gap-3 overflow-hidden">
									<div class="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
										<div
											style="width: {(outcome.probability ?? 0) * 100}%"
											class="absolute inset-y-0 left-0 bg-indigo-500 transition-all duration-500"
										></div>
									</div>
									<span
										class="truncate text-xs font-bold text-slate-700 transition-colors group-hover/outcome:text-indigo-600"
									>
										{outcome.title}
									</span>
								</div>
								<span class="ml-4 text-xs font-black text-slate-900">
									{formatProbability(outcome.probability ?? 0)}
								</span>
							</a>
						{/each}

						{#if nonNullish(market.outcomes?.length) && market.outcomes.length > 3}
							<div class="mt-1 text-center">
								<span class="text-[10px] font-bold text-slate-400 italic">
									+ {market.outcomes.length - 3} others
								</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}
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
