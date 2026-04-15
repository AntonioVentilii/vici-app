<script lang="ts">
	import { Clock, Users, UsersRound } from 'lucide-svelte/icons';
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import BinaryProbabilities from '$lib/components/market/BinaryProbabilities.svelte';
	import CategoricalProbabilities from '$lib/components/market/CategoricalProbabilities.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
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
			<div
				class="h-1.5 w-full {isChallenge
					? 'bg-gradient-to-r from-fuchsia-500 to-violet-500'
					: 'bg-border'}"
			></div>

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
							{#if isChallenge}
								<span
									class="inline-flex items-center gap-1 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2 py-0.5 text-[10px] font-bold tracking-widest text-fuchsia-700 uppercase"
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
								yesProbability={market.yesProbability}
							/>
						{:else}
							<CategoricalProbabilities outcomes={market.outcomes ?? []} />
						{/if}
					</div>

					<!-- Footer Stats -->
					<div class="border-border flex items-center justify-between border-t pt-5">
						<div class="text-muted-foreground/60 flex items-center gap-1.5">
							<Clock size={14} />
							<span class="text-xs font-bold whitespace-nowrap">
								{getTimeRemaining(market.expiryDate)}
							</span>
						</div>
						{#if onChallenge}
							<button
								class="text-muted-foreground/40 hover:text-primary cursor-pointer rounded-lg p-1 transition-colors hover:bg-slate-100"
								aria-label="Challenge friends"
								onclick={(e) => {
									e.stopPropagation();
									onChallenge(market);
								}}
								onkeydown={(e) => e.stopPropagation()}
								title="Challenge friends"
							>
								<UsersRound size={18} />
							</button>
						{:else}
							<div
								class="text-muted-foreground/40 group-hover:text-primary/50 flex items-center gap-1 transition-colors"
								title="Challenge friends"
							>
								<UsersRound size={18} />
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</Card>
</div>
