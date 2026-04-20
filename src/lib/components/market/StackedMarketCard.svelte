<script lang="ts">
	import { Layers, UsersRound } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import MarketCard from '$lib/components/market/MarketCard.svelte';
	import PrincipalText from '$lib/components/ui/PrincipalText.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
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

	const openFork = (fork: Market) => {
		popoverOpen = false;
		goto(`${AppPath.Markets}/${fork.id}`);
	};

	// Close-on-outside-click: only attach the window listener while the
	// popover is open, so a feed of N cards doesn't register N global
	// click handlers that all fire on every click.
	$effect(() => {
		if (!popoverOpen) {
			return;
		}

		const onWindowClick = () => {
			popoverOpen = false;
		};

		window.addEventListener('click', onWindowClick);

		return () => window.removeEventListener('click', onWindowClick);
	});
</script>

<div class="relative isolate h-full w-full">
	{#if ghostLayers >= 1}
		<div
			class="pointer-events-none absolute inset-0 -z-10 translate-x-[6px] translate-y-[6px] rounded-2xl bg-white shadow-md ring-1 ring-slate-200/80"
			aria-hidden="true"
		></div>
	{/if}
	{#if ghostLayers >= 2}
		<div
			class="pointer-events-none absolute inset-0 -z-20 translate-x-[12px] translate-y-[12px] rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"
			aria-hidden="true"
		></div>
	{/if}

	<MarketCard {index} market={group.root} onChallenge={showFaceChallenge} />

	{#if forks.length > 0}
		<div class="absolute top-3 right-3 z-10">
			<div class="relative">
				<button
					class="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-200 bg-white/90 px-2.5 py-1 text-[11px] font-bold text-fuchsia-700 shadow-sm backdrop-blur transition-colors hover:border-fuchsia-400 hover:bg-fuchsia-50"
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
						class="absolute top-full right-0 z-20 mt-2 w-64 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
						onclick={(e) => e.stopPropagation()}
						onkeydown={(e) => e.stopPropagation()}
						role="menu"
						tabindex="-1"
					>
						<div
							class="px-2 pt-1 pb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase"
						>
							Your circles for this market
						</div>

						<ul class="max-h-64 space-y-1 overflow-y-auto">
							{#each forks as fork (fork.id)}
								{@const isMine = userPrincipal !== undefined && fork.creator === userPrincipal}
								<li>
									<button
										class="group flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-fuchsia-50"
										onclick={() => openFork(fork)}
										type="button"
									>
										<div
											class="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-100 to-violet-100 text-fuchsia-700"
										>
											<UsersRound size={14} />
										</div>
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-1.5">
												<span class="truncate text-sm font-semibold text-slate-800">
													{#if isMine}
														Your circle
													{:else}
														{fork.title}
													{/if}
												</span>
												{#if isMine}
													<span
														class="rounded-full bg-fuchsia-100 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-fuchsia-700 uppercase"
													>
														You
													</span>
												{/if}
											</div>
											<div class="text-[11px] text-slate-400">
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
