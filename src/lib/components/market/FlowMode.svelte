<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onMount, onDestroy } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import FlowCard from '$lib/components/market/FlowCard.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { flowTradeService } from '$lib/services/flow.services';
	import { getFlowQueue } from '$lib/services/market.services';
	import { getPositions } from '$lib/services/position.services';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { userStore } from '$lib/stores/user.store';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';

	const MAX_BETS = 10;
	const MAX_MARKETS = 20;

	let markets = $state<Market[]>([]);

	let currentIndex = $state(0);

	let loading = $state(true);

	let tradeAmount = $state('1.0');

	let betsCount = $state(0);

	let completed = $state(false);

	let positions = $state<Position[]>([]);

	let exitX = $state(0);
	let exitY = $state(0);

	onMount(async () => {
		// Prevent scrolling on mobile while in Flow Mode
		document.body.classList.add('overflow-hidden');

		flowTradeService.startSession();

		try {
			const [queue, userPositions] = await Promise.all([
				getFlowQueue(),
				nonNullish($userStore.user) ? getPositions() : Promise.resolve([])
			]);

			markets = queue.slice(0, MAX_MARKETS);
			positions = userPositions;

			// Set default amount from profile preferences
			if ($userStore.profile?.preferences?.defaultAmount?.flow) {
				tradeAmount = $userStore.profile.preferences.defaultAmount.flow;
			}
		} catch (e) {
			console.error('Failed to load Flow queue', e);
		} finally {
			loading = false;
		}
	});

	onDestroy(() => {
		// Re-enable scrolling when leaving Flow Mode
		document.body.classList.remove('overflow-hidden');

		void flowTradeService.endSession();
	});

	const handleAction = (action: 'YES' | 'NO' | 'SKIP') => {
		if (completed) {
			return;
		}

		const currentMarket = markets[currentIndex];
		if (!currentMarket) {
			return;
		}

		// Set exit animation direction
		if (action === 'YES') {
			exitX = 500;
			exitY = 20;
		} else if (action === 'NO') {
			exitX = -500;
			exitY = 20;
		} else if (action === 'SKIP') {
			exitX = 0;
			exitY = -500;
		}

		if (action === 'SKIP') {
			advance();
			return;
		}

		// AUTH CHECK: Guests cannot trade
		if (isNullish($userStore.user)) {
			notificationsStore.add({
				title: 'Sign In Required',
				message: 'Please sign in to place trades in Flow Mode.',
				type: 'warning'
			});

			return;
		}

		// ASYNCHRONOUS TRADE EXECUTION (Non-awaited)
		// We prepare the data and fire the trade in the background via FlowTradeService
		const executeTrade = async () => {
			try {
				await flowTradeService.executeTrade({
					market: currentMarket,
					action,
					amount: tradeAmount
				});
			} catch (e) {
				notificationsStore.add({
					title: 'Trade Failed',
					message: `Order for "${currentMarket.title.slice(0, 30)}..." failed: ${(e as Error).message}`,
					type: 'error'
				});
			}
		};

		// Fire and forget
		void executeTrade();

		// Immediately update UI
		betsCount += 1;

		// Optimistically update positions for the badge if needed,
		// but since we advance it's mainly for history if we were to go back (which we don't yet)

		advance();
	};

	const advance = () => {
		if (currentIndex < markets.length - 1 && betsCount < MAX_BETS) {
			currentIndex += 1;
		} else {
			completed = true;
		}
	};

	const backToMarkets = () => {
		goto(AppPath.Home);
	};
</script>

<div class="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center px-4">
	{#if loading}
		<div in:fade>
			<LoadingSpinner />
			<p class="mt-4 font-medium text-slate-500">Preparing your Flow queue...</p>
		</div>
	{:else if completed || markets.length === 0}
		<div class="max-w-md text-center" in:fly={{ y: 20 }}>
			<div
				class="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
			>
				<svg
					class="h-10 w-10"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M5 13l4 4L19 7"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="3"
					/>
				</svg>
			</div>
			<h2 class="mb-4 text-3xl font-black text-slate-950">Flow Complete!</h2>
			<p class="mb-8 text-slate-600">
				You've reviewed all available markets. Great job keeping up with the pulse!
			</p>

			<Button onclick={backToMarkets}>Back to Markets</Button>
		</div>
	{:else}
		<!-- Header Info -->
		<div class="mb-1 flex w-full max-w-90 flex-row items-center justify-between sm:mb-2" in:fade>
			<div class="mb-1 flex items-center gap-1 sm:mb-2 sm:gap-3">
				<div class="flex flex-col items-end">
					<span class="text-[8px] font-bold tracking-widest text-slate-400 uppercase">Done</span>
					<span class="text-xs font-black text-slate-900">{betsCount}/{MAX_BETS}</span>
				</div>
				<div class="flex flex-col items-end border-l border-slate-200 pl-3">
					<span class="text-[8px] font-bold tracking-widest text-slate-400 uppercase">Seen</span>
					<span class="text-xs font-black text-slate-900">{currentIndex + 1}/{MAX_MARKETS}</span>
				</div>
			</div>
			<div
				class="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 ring-1 ring-slate-200 transition-all focus-within:ring-2 focus-within:ring-indigo-500"
			>
				<input
					class="w-12 bg-transparent text-center text-sm font-black text-slate-950 outline-none"
					min="1"
					step="0.1"
					type="number"
					bind:value={tradeAmount}
				/>
				<span class="text-[10px] font-bold text-slate-500">USD</span>
			</div>
		</div>

		<!-- Card Container -->
		<div class="relative h-150 w-full max-w-95">
			{#each markets.slice(currentIndex, currentIndex + 2) as market, i (market?.id)}
				{@const isCurrent = i === 0}
				<div
					style="z-index: {20 - i}"
					class="absolute inset-0"
					in:fly={isCurrent && currentIndex === 0
						? { y: 300, duration: 600, easing: cubicOut }
						: { y: 100, opacity: 0, duration: 500, easing: cubicOut }}
					out:fly={{ x: exitX, y: exitY, duration: 450, opacity: 0, easing: cubicOut }}
				>
					<div
						class="h-full w-full transition-all duration-500 ease-out"
						class:opacity-40={!isCurrent}
						class:scale-95={!isCurrent}
						class:translate-y-4={!isCurrent}
					>
						<FlowCard
							isLimitOrderNo={isNullish(market.bestBid)}
							isLimitOrderYes={isNullish(market.bestAsk)}
							{market}
							onAction={handleAction}
							position={positions.find((p) => p.marketId === market.id)}
							signedIn={nonNullish($userStore.user)}
							{tradeAmount}
						/>
					</div>
				</div>
			{/each}
		</div>

		<!-- Controls Hint -->
		<div class="mt-12 text-center text-slate-400" in:fade>
			<div
				class="flex items-center justify-center gap-8 text-[10px] font-black tracking-widest uppercase"
			>
				<div class="flex flex-col items-center gap-2">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-slate-200"
					>
						←
					</div>
					<span>NO</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-slate-200"
					>
						↑
					</div>
					<span>SKIP</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-slate-200"
					>
						→
					</div>
					<span>YES</span>
				</div>
			</div>
		</div>
	{/if}
</div>

<svelte:window
	onkeydown={(e) => {
		if (loading || completed) {
			return;
		}
		if (e.key === 'ArrowRight') {
			void handleAction('YES');
		}
		if (e.key === 'ArrowLeft') {
			void handleAction('NO');
		}
		if (e.key === 'ArrowUp') {
			handleAction('SKIP');
		}
	}}
/>
