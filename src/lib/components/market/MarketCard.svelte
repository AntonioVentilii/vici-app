<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import { Clock, Copy, Users, UsersRound } from 'lucide-svelte/icons';
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import BinaryProbabilities from '$lib/components/market/BinaryProbabilities.svelte';
	import CategoricalProbabilities from '$lib/components/market/CategoricalProbabilities.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import type { Market } from '$lib/types/market';
	import { isSocial } from '$lib/utils/balance-domain.utils';
	import { getOutcomeVariant, getTimeRemaining } from '$lib/utils/market.utils';

	interface Props {
		market: Market;
		index?: number;
		onChallenge?: (market: Market) => void;
	}

	const { market, index = 0, onChallenge }: Props = $props();

	const isChallenge = $derived(isSocial(market.balanceDomain));
	const isFork = $derived(market.forkedFrom !== undefined);
	const isResolved = $derived(market.status === 'Resolved');
	const showChallengeSlot = $derived(!isFork && !isResolved);
</script>

<div class="h-full w-full" in:fly={{ y: 20, duration: 400, delay: Math.min(index * 50, 300) }}>
	<Card
		class="group border-border shadow-inset-hi hover:border-border-strong h-full w-full overflow-hidden border transition-all hover:-translate-y-0.5"
		onclick={() => goto(`${AppPath.Markets}/${market.id}`)}
		onkeydown={(e) => e.key === 'Enter' && goto(`${AppPath.Markets}/${market.id}`)}
		padding="none"
		role="button"
		variant="default"
	>
		<div class="flex h-full w-full flex-col text-left">
			<div class="flex flex-1 flex-col gap-5 p-6 sm:p-8">
				<div class="flex items-start justify-between gap-4">
					<div class="flex flex-col gap-1">
						<h3
							class="text-foreground group-hover:text-primary font-display text-xl leading-snug font-semibold tracking-tight transition-colors sm:text-2xl"
						>
							{market.title}
						</h3>
						<div class="flex items-center gap-2">
							<Badge variant={getOutcomeVariant(market.status)}>
								{market.status}
							</Badge>
							{#if isResolved && nonNullish(market.outcome)}
								<Badge variant={getOutcomeVariant(market.outcome)}>
									{market.outcome === 'YES'
										? 'YES won'
										: market.outcome === 'NO'
											? 'NO won'
											: market.outcome === 'CANCELED'
												? 'Canceled'
												: (market.outcomes?.find((o) => o.id === market.outcome)?.title ??
													market.outcome)}
								</Badge>
							{/if}
							{#if isChallenge}
								<span
									class="border-laurel/25 bg-laurel-glow text-laurel inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase"
								>
									<Users size={10} />
									Challenge
								</span>
							{/if}
							{#if market.payoffType === 'Categorical'}
								<span
									class="border-foreground/25 text-foreground bg-foreground/8 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase"
								>
									Multiple
								</span>
							{/if}
							{#if market.isInviteOnly}
								<Badge size="sm" variant="warning">Closed Circle</Badge>
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
							<BinaryProbabilities
								noProbability={market.noProbability}
								winningOutcome={isResolved ? market.outcome : undefined}
								yesProbability={market.yesProbability}
							/>
						{:else}
							<CategoricalProbabilities
								outcomes={market.outcomes ?? []}
								winningOutcomeId={isResolved ? market.outcome : undefined}
							/>
						{/if}
					</div>

					<!-- Footer Stats -->
					<div class="border-border flex items-center justify-between border-t pt-5">
						<div class="text-muted-foreground/60 flex items-center gap-1.5">
							<Clock size={14} />
							<span
								class="text-xs font-bold whitespace-nowrap"
								data-tid={TestId.MarketTimeRemaining}
							>
								{getTimeRemaining(market.expiryDate)}
							</span>
						</div>
						{#if showChallengeSlot}
							{#if onChallenge}
								<button
									class="text-muted-foreground/40 hover:text-primary hover:bg-laurel-glow flex items-center gap-1 rounded-lg p-1 transition-colors"
									aria-label="Challenge friends"
									onclick={(e) => {
										e.stopPropagation();
										onChallenge(market);
									}}
									onkeydown={(e) => e.stopPropagation()}
									title="Challenge friends"
								>
									<Copy size={14} />
									<UsersRound size={18} />
								</button>
							{:else}
								<div
									class="text-muted-foreground/40 group-hover:text-primary/50 flex items-center gap-1 transition-colors"
									title="Challenge friends"
								>
									<Copy size={14} />
									<UsersRound size={18} />
								</div>
							{/if}
						{/if}
					</div>
				</div>
			</div>
		</div>
	</Card>
</div>
