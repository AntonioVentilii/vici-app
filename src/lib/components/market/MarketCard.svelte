<script lang="ts">
	import { Clock, ArrowRight } from 'lucide-svelte/icons';
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import type { Market } from '$lib/types/market';
	import { formatProbability } from '$lib/utils/format.utils';
	import { getTimeRemaining, getOutcomeVariant } from '$lib/utils/market.utils';

	interface Props {
		market: Market;
		index?: number;
	}

	const { market, index = 0 }: Props = $props();
</script>

<div in:fly={{ y: 20, duration: 400, delay: Math.min(index * 50, 300) }}>
	<Card
		class="group overflow-hidden border-none shadow-md transition-all hover:-translate-y-1 hover:shadow-xl"
		onclick={() => goto(`${AppPath.Markets}/${market.id}`)}
		onkeydown={(e) => e.key === 'Enter' && goto(`${AppPath.Markets}/${market.id}`)}
		padding="none"
		role="button"
		variant="default"
	>
		<div class="flex h-full flex-col text-left">
			<!-- Header Gradient/Banner -->
			<div class="h-2 w-full bg-linear-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

			<div class="flex flex-col gap-5 p-6 sm:p-8">
				<div class="flex items-start justify-between gap-4">
					<div class="flex flex-col gap-1">
						<h3
							class="text-xl leading-snug font-black tracking-tight text-slate-900 transition-colors group-hover:text-indigo-600 sm:text-2xl"
						>
							{market.title}
						</h3>
						<div class="flex items-center gap-2">
							<Badge variant={getOutcomeVariant(market.status)}>
								{market.status}
							</Badge>
							{#if market.payoffType === 'Categorical'}
								<span
									class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase"
								>
									Multiple
								</span>
							{/if}
						</div>
					</div>
				</div>

				<p class="line-clamp-3 text-sm leading-relaxed text-slate-500 sm:text-base">
					{market.description}
				</p>

				<!-- Probabilities Area -->
				<div class="grid grid-cols-2 gap-4">
					{#if market.payoffType === 'Binary'}
						<div
							class="relative flex flex-col items-center rounded-2xl border border-rose-100 bg-rose-50/50 p-4 transition-colors hover:bg-rose-50"
						>
							<div class="mb-1 text-[10px] font-bold tracking-widest text-rose-500 uppercase">
								No
							</div>
							<div class="text-2xl font-black text-rose-600">
								{formatProbability(market.noProbability)}
							</div>
						</div>

						<div
							class="relative flex flex-col items-center rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 transition-colors hover:bg-emerald-50"
						>
							<div class="mb-1 text-[10px] font-bold tracking-widest text-emerald-600 uppercase">
								Yes
							</div>
							<div class="text-2xl font-black text-emerald-600">
								{formatProbability(market.yesProbability)}
							</div>
						</div>
					{:else}
						<div
							class="col-span-2 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-5"
						>
							<div class="flex items-center justify-between">
								<div class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
									Top Outcomes
								</div>
								<div class="text-[10px] font-bold tracking-widest text-indigo-500 uppercase">
									{market.outcomes?.length ?? 0} total
								</div>
							</div>

							<div class="flex flex-col gap-3">
								{#each (market.outcomes ?? [])
									.toSorted(// eslint-disable-next-line local-rules/prefer-object-params
										(a, b) => {
											const probA = a.probability ?? 0;
											const probB = b.probability ?? 0;
											return probB - probA || a.title.localeCompare(b.title);
										})
									.slice(0, 3) as outcome (outcome.id)}
									<div class="flex flex-col gap-1.5">
										<div class="flex items-center justify-between text-xs">
											<span class="font-bold text-slate-700">{outcome.title}</span>
											<span class="font-black text-slate-900">
												{formatProbability(outcome.probability ?? 0)}
											</span>
										</div>
										<div
											class="h-1.5 w-full overflow-hidden rounded-full bg-white ring-1 ring-slate-100 ring-inset"
										>
											<div
												style="width: {(outcome.probability ?? 0) * 100}%"
												class="h-full bg-indigo-500 transition-all duration-700 ease-out"
											></div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- Footer Stats -->
				<div class="flex items-center justify-between border-t border-slate-100 pt-5">
					<div class="flex items-center gap-4">
						<div class="flex items-center gap-1.5 text-slate-400">
							<Clock size={14} />
							<span class="text-xs font-bold whitespace-nowrap">
								{getTimeRemaining(market.expiryDate)}
							</span>
						</div>
					</div>

					<div
						class="flex items-center gap-1 font-bold text-indigo-600 transition-transform group-hover:translate-x-1"
					>
						<span class="text-xs">Predict Now</span>
						<ArrowRight size={14} />
					</div>
				</div>
			</div>
		</div>
	</Card>
</div>
