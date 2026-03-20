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

<div class="h-full w-full" in:fly={{ y: 20, duration: 400, delay: Math.min(index * 50, 300) }}>
	<Card
		class="group h-full w-full overflow-hidden border-none shadow-md transition-all hover:-translate-y-1 hover:shadow-xl"
		onclick={() => goto(`${AppPath.Markets}/${market.id}`)}
		onkeydown={(e) => e.key === 'Enter' && goto(`${AppPath.Markets}/${market.id}`)}
		padding="none"
		role="button"
		variant="default"
	>
		<div class="flex h-full w-full flex-col text-left">
			<!-- Header Border -->
			<div class="bg-border h-1.5 w-full"></div>

			<div class="flex flex-1 flex-col gap-5 p-6 sm:p-8">
				<div class="flex items-start justify-between gap-4">
					<div class="flex flex-col gap-1">
						<h3
							class="text-foreground group-hover:text-primary font-serif text-xl leading-snug font-black tracking-tight transition-colors sm:text-2xl"
						>
							{market.title}
						</h3>
						<div class="flex items-center gap-2">
							<Badge variant={getOutcomeVariant(market.status)}>
								{market.status}
							</Badge>
							{#if market.payoffType === 'Categorical'}
								<span
									class="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase"
								>
									Multiple
								</span>
							{/if}
						</div>
					</div>
				</div>

				<p class="text-muted-foreground line-clamp-3 text-sm leading-relaxed sm:text-base">
					{market.description}
				</p>

				<div class="mt-auto space-y-5">
					<!-- Probabilities Area -->
					<div class="grid grid-cols-2 gap-4">
						{#if market.payoffType === 'Binary'}
							<div
								class="border-destructive/20 bg-destructive/5 hover:bg-destructive/10 relative flex flex-col items-center rounded-2xl border p-4 transition-colors"
							>
								<div class="text-destructive mb-1 text-[10px] font-bold tracking-widest uppercase">
									No
								</div>
								<div class="text-destructive font-serif text-2xl font-black">
									{formatProbability(market.noProbability)}
								</div>
							</div>

							<div
								class="border-success/20 bg-success/5 hover:bg-success/10 relative flex flex-col items-center rounded-2xl border p-4 transition-colors"
							>
								<div class="text-success mb-1 text-[10px] font-bold tracking-widest uppercase">
									Yes
								</div>
								<div class="text-success font-serif text-2xl font-black">
									{formatProbability(market.yesProbability)}
								</div>
							</div>
						{:else}
							<div
								class="border-border bg-muted/30 col-span-2 flex flex-col gap-3 rounded-2xl border p-5"
							>
								<div class="flex items-center justify-between">
									<div
										class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase"
									>
										Top Outcomes
									</div>
									<div class="text-primary text-[10px] font-bold tracking-widest uppercase">
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
										.slice(0, 2) as outcome (outcome.id)}
										<div class="flex flex-col gap-1.5">
											<div class="flex items-center justify-between text-xs">
												<span class="text-foreground font-bold">{outcome.title}</span>
												<span class="text-foreground font-serif font-black">
													{formatProbability(outcome.probability ?? 0)}
												</span>
											</div>
											<div
												class="bg-background ring-border h-1.5 w-full overflow-hidden rounded-full ring-1 ring-inset"
											>
												<div
													style="width: {(outcome.probability ?? 0) * 100}%"
													class="bg-primary h-full transition-all duration-700 ease-out"
												></div>
											</div>
										</div>
									{/each}
									{#if (market.outcomes?.length ?? 0) > 2}
										<div class="flex items-center justify-center pt-1">
											<span class="text-primary text-[10px] font-black tracking-widest uppercase"
												>+ {(market.outcomes?.length ?? 0) - 2} Other...</span
											>
										</div>
									{/if}
								</div>
							</div>
						{/if}
					</div>

					<!-- Footer Stats -->
					<div class="border-border flex items-center justify-between border-t pt-5">
						<div class="flex items-center gap-4">
							<div class="text-muted-foreground/60 flex items-center gap-1.5">
								<Clock size={14} />
								<span class="text-xs font-bold whitespace-nowrap">
									{getTimeRemaining(market.expiryDate)}
								</span>
							</div>
						</div>

						<div
							class="text-primary flex items-center gap-1 font-bold transition-transform group-hover:translate-x-1"
						>
							<span class="text-xs">Predict Now</span>
							<ArrowRight size={14} />
						</div>
					</div>
				</div>
			</div>
		</div>
	</Card>
</div>
