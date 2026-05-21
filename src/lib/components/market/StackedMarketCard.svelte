<script lang="ts">
	import { Layers, UsersRound } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MarketCard from '$lib/components/market/MarketCard.svelte';
	import PrincipalText from '$lib/components/ui/PrincipalText.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import type { Market } from '$lib/types/market';
	import type { MarketGroup } from '$lib/utils/market-groups.utils';

	interface Props {
		group: MarketGroup;
		index?: number;
		userPrincipal?: string;
		onChallenge?: (market: Market) => void;
	}

	const { group, index = 0, userPrincipal, onChallenge }: Props = $props();

	const forks = $derived(group.forks);
	const ghostLayers = $derived(Math.min(forks.length, 2));
	const showFaceChallenge = $derived(group.root.forkedFrom === undefined ? onChallenge : undefined);

	let popoverOpen = $state(false);

	const togglePopover = (e: MouseEvent) => {
		e.stopPropagation();
		popoverOpen = !popoverOpen;
	};

	const closePopover = () => {
		popoverOpen = false;
	};

	const handleWindowClick = () => {
		if (popoverOpen) {
			closePopover();
		}
	};

	const openFork = (fork: Market) => {
		popoverOpen = false;
		goto(resolve(`${AppPath.Markets}/${fork.id}`));
	};
</script>

<svelte:window onclick={handleWindowClick} />

<div class="relative isolate h-full w-full" data-tid={TestId.MarketCard}>
	{#if ghostLayers >= 1}
		<div
			class="bg-card ring-border/80 pointer-events-none absolute inset-0 -z-10 translate-x-[5px] translate-y-[5px] rounded-2xl ring-1"
			aria-hidden="true"
		></div>
	{/if}
	{#if ghostLayers >= 2}
		<div
			class="bg-card ring-border/50 pointer-events-none absolute inset-0 -z-20 translate-x-[10px] translate-y-[10px] rounded-2xl ring-1"
			aria-hidden="true"
		></div>
	{/if}

	<MarketCard {index} market={group.root} onChallenge={showFaceChallenge} />

	{#if forks.length > 0}
		<div class="absolute top-3 right-3 z-10">
			<div class="relative">
				<button
					class="border-primary/30 bg-card/90 text-primary hover:border-primary/50 hover:bg-primary/10 shadow-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold backdrop-blur transition-colors"
					aria-expanded={popoverOpen}
					aria-haspopup="menu"
					aria-label={`${forks.length} more ${forks.length === 1 ? 'circle' : 'circles'}`}
					onclick={togglePopover}
					title="See forks of this market"
					type="button"
				>
					<Layers size={12} />
					<span>+{forks.length} {forks.length === 1 ? 'circle' : 'circles'}</span>
				</button>

				{#if popoverOpen}
					<div
						class="border-border bg-card absolute top-full right-0 z-20 mt-2 w-64 origin-top-right rounded-2xl border p-2 shadow-xl"
						onclick={(e) => e.stopPropagation()}
						onkeydown={(e) => e.stopPropagation()}
						role="menu"
						tabindex="-1"
					>
						<div
							class="text-muted-foreground px-2 pt-1 pb-2 text-[10px] font-bold tracking-widest uppercase"
						>
							Your circles for this market
						</div>

						<ul class="max-h-64 space-y-1 overflow-y-auto">
							{#each forks as fork (fork.id)}
								{@const isMine = userPrincipal !== undefined && fork.creator === userPrincipal}
								<li>
									<button
										class="group hover:bg-primary/10 flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors"
										onclick={() => openFork(fork)}
										type="button"
									>
										<div
											class="bg-primary/10 text-primary mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full"
										>
											<UsersRound size={14} />
										</div>
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-1.5">
												<span class="text-foreground truncate text-sm font-semibold">
													{#if isMine}
														Your circle
													{:else}
														{fork.title}
													{/if}
												</span>
												{#if isMine}
													<span
														class="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase"
													>
														You
													</span>
												{/if}
											</div>
											<div class="text-muted-foreground text-[11px]">
												by <PrincipalText principal={fork.creator} splitLength={4} />
											</div>
										</div>
									</button>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
