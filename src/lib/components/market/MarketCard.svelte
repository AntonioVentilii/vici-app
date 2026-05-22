<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import { Clock, Copy, Users, UsersRound } from 'lucide-svelte/icons';
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import BinaryProbabilities from '$lib/components/market/BinaryProbabilities.svelte';
	import CategoricalProbabilities from '$lib/components/market/CategoricalProbabilities.svelte';
	import OutcomeBadge from '$lib/components/market/OutcomeBadge.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import { isSocial } from '$lib/utils/balance-domain.utils';
	import { t } from '$lib/utils/i18n.utils';
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

	const resolvedOutcomeLabel = (outcome: string): string => {
		if (outcome === 'YES') {
			return t({ locale: $localeStore, key: 'outcome.yes_won' });
		}

		if (outcome === 'NO') {
			return t({ locale: $localeStore, key: 'outcome.no_won' });
		}

		if (outcome === 'CANCELED') {
			return t({ locale: $localeStore, key: 'outcome.canceled' });
		}

		return market.outcomes?.find((o) => o.id === outcome)?.title ?? outcome;
	};
</script>

<div class="h-full w-full" in:fly={{ y: 12, duration: 320, delay: Math.min(index * 35, 210) }}>
	<Card
		class="group border-border hover:border-border-strong bg-card/85 shadow-card hover:bg-card h-full w-full overflow-hidden border transition-all hover:-translate-y-0.5"
		onclick={() => goto(resolve(`${AppPath.Markets}/${market.id}`))}
		onkeydown={(e) => e.key === 'Enter' && goto(resolve(`${AppPath.Markets}/${market.id}`))}
		padding="none"
		role="button"
		variant="default"
	>
		<div class="flex h-full w-full flex-col text-left">
			<div class="flex flex-1 flex-col gap-4 p-4 sm:p-5">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="flex flex-wrap items-center gap-1.5">
						<OutcomeBadge status={market.status} />
						{#if isResolved && nonNullish(market.outcome)}
							<Badge variant={getOutcomeVariant(market.outcome)}>
								{resolvedOutcomeLabel(market.outcome)}
							</Badge>
						{/if}
						{#if isChallenge}
							<span
								class="border-laurel/25 bg-laurel-glow text-laurel eyebrow-xs inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
							>
								<Users aria-hidden="true" size={10} />
								{t({ locale: $localeStore, key: 'card.challenge' })}
							</span>
						{/if}
						{#if market.payoffType === 'Categorical'}
							<span
								class="border-foreground/25 text-foreground bg-foreground/8 eyebrow-xs rounded-full border px-2 py-0.5"
							>
								{t({ locale: $localeStore, key: 'card.multiple' })}
							</span>
						{/if}
						{#if market.isInviteOnly}
							<Badge size="sm" variant="warning">
								{t({ locale: $localeStore, key: 'markets.filter.access.closed' })}
							</Badge>
						{/if}
					</div>

					<div class="text-muted-foreground/70 flex items-center gap-1.5">
						<Clock aria-hidden="true" size={13} />
						<span
							class="num text-[11px] font-bold whitespace-nowrap"
							data-tid={TestId.MarketTimeRemaining}
						>
							{getTimeRemaining(market.expiryDate)}
						</span>
					</div>
				</div>

				<div class="space-y-2">
					<h3
						class="text-foreground group-hover:text-primary font-display text-[15px] leading-snug font-semibold tracking-tight transition-colors sm:text-base"
					>
						{market.title}
					</h3>
					<p class="text-muted-foreground line-clamp-2 text-xs leading-relaxed sm:text-sm">
						{market.description}
					</p>
				</div>

				<div class="mt-auto space-y-4">
					<div class="grid grid-cols-2 gap-2.5">
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

					<div class="border-border flex min-h-8 items-center justify-end border-t pt-3">
						{#if showChallengeSlot}
							{#if onChallenge}
								<button
									class="text-muted-foreground/50 hover:text-primary hover:bg-laurel-glow flex items-center gap-1 rounded-lg px-2 py-1 transition-colors"
									aria-label={t({ locale: $localeStore, key: 'card.challenge_friends' })}
									onclick={(e) => {
										e.stopPropagation();
										onChallenge(market);
									}}
									onkeydown={(e) => e.stopPropagation()}
									title={t({ locale: $localeStore, key: 'card.challenge_friends' })}
								>
									<Copy aria-hidden="true" size={14} />
									<UsersRound aria-hidden="true" size={18} />
								</button>
							{:else}
								<div
									class="text-muted-foreground/40 group-hover:text-primary/50 flex items-center gap-1 px-2 py-1 transition-colors"
									title={t({ locale: $localeStore, key: 'card.challenge_friends' })}
								>
									<Copy aria-hidden="true" size={14} />
									<UsersRound aria-hidden="true" size={18} />
								</div>
							{/if}
						{/if}
					</div>
				</div>
			</div>
		</div>
	</Card>
</div>
