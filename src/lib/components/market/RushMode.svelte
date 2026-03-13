<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import RushCard from '$lib/components/market/RushCard.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { getRushQueue } from '$lib/services/market.services';
	import { placeOrder } from '$lib/services/order.services';
	import { userStore } from '$lib/stores/user.store';
	import type { Market } from '$lib/types/market';
	import type { OrderType } from '$lib/types/order';

	const MAX_BETS = 10;
	const MAX_MARKETS = 20;

	let markets = $state<Market[]>([]);

	let currentIndex = $state(0);

	let loading = $state(true);

	let tradeAmount = $state('0.1');

	let betsCount = $state(0);

	let completed = $state(false);

	let notifications = $state<
		{ id: string; title: string; message: string; type: 'error' | 'success' }[]
	>([]);

	const addNotification = ({
		title,
		message,
		type
	}: {
		title: string;
		message: string;
		type: 'error' | 'success';
	}) => {
		const id = Math.random().toString(36).substring(2, 9);

		notifications = [...notifications, { id, title, message, type }];

		setTimeout(() => {
			notifications = notifications.filter((n) => n.id !== id);
		}, 5000);
	};

	onMount(async () => {
		// Prevent scrolling on mobile while in Rush Mode
		document.body.classList.add('overflow-hidden');

		try {
			const queue = await getRushQueue();

			markets = queue.slice(0, MAX_MARKETS);
		} catch (e) {
			console.error('Failed to load Rush queue', e);
		} finally {
			loading = false;
		}
	});

	onDestroy(() => {
		// Re-enable scrolling when leaving Rush Mode
		document.body.classList.remove('overflow-hidden');
	});

	const handleAction = (action: 'YES' | 'NO' | 'SKIP') => {
		if (completed) {
			return;
		}

		const currentMarket = markets[currentIndex];
		if (!currentMarket) {
			return;
		}

		if (action === 'SKIP') {
			advance();
			return;
		}

		// AUTH CHECK: Guests cannot trade
		if (isNullish($userStore.user)) {
			alert('Please sign in to place trades in Rush Mode.');

			return;
		}

		// ASYNCHRONOUS TRADE EXECUTION (Non-awaited)
		// We prepare the data and fire the trade in the background
		const executeTrade = async () => {
			try {
				const decimals = BigInt(currentMarket.token.decimals);
				const amountE8 = BigInt(Math.floor(parseFloat(tradeAmount) * Number(10n ** decimals)));

				// Use best execution price if available, otherwise fallback to probability
				let price: number;
				let type: OrderType = 'LIMIT';

				if (action === 'YES') {
					const { bestAsk } = currentMarket;
					if (nonNullish(bestAsk)) {
						price = bestAsk;
						type = 'MARKET';
					} else {
						price = currentMarket.yesProbability;
						type = 'LIMIT';
					}
				} else {
					// For NO, we want to Buy the "NO" side, which is equivalent to Selling "YES" at bestBid
					// bestBid is the price for YES, so 1 - bestBid is the price for NO.
					const { bestBid } = currentMarket;
					if (nonNullish(bestBid)) {
						price = 1 - bestBid;
						type = 'MARKET';
					} else {
						price = currentMarket.noProbability;
						type = 'LIMIT';
					}
				}

				// qty = amount / price (normalized to token decimals)
				// Safety: Ensure price is not zero to avoid division by zero
				const executionPrice = Math.max(price, 0.01);
				const qty =
					(amountE8 * 10n ** decimals) /
					BigInt(Math.floor(executionPrice * Number(10n ** decimals)));

				await placeOrder({
					marketId: currentMarket.id,
					side: 'BUY',
					type,
					price: executionPrice,
					qty,
					outcome: action
				});
			} catch (e) {
				console.error('Background trade failed', e);

				addNotification({
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
			<p class="mt-4 font-medium text-slate-500">Preparing your Rush queue...</p>
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
			<h2 class="mb-4 text-3xl font-black text-slate-950">Rush Complete!</h2>
			<p class="mb-8 text-slate-600">
				You've reviewed all available markets. Great job keeping up with the pulse!
			</p>

			<Button onclick={backToMarkets}>Back to Markets</Button>
		</div>
	{:else}
		<!-- Header Info -->
		<div class="mb-8 flex w-full max-w-90 items-center justify-between" in:fade>
			<div class="flex flex-col">
				<h1 class="text-2xl font-black text-slate-950">Rush Mode</h1>
				<span class="text-xs font-bold tracking-widest text-slate-400 uppercase">
					Market {currentIndex + 1} of {markets.length}
				</span>
			</div>
			<div class="flex flex-col items-end">
				<div class="mb-2 flex items-center gap-3">
					<div class="flex flex-col items-end">
						<span class="text-[8px] font-bold tracking-widest text-slate-400 uppercase">Bets</span>
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
						min="0.1"
						step="0.1"
						type="number"
						bind:value={tradeAmount}
					/>
					<span class="text-[10px] font-bold text-slate-500">ICP</span>
				</div>
			</div>
		</div>

		<!-- Card Container -->
		<div class="relative h-125 w-full max-w-90">
			{#each [markets[currentIndex]] as market (market.id)}
				<div
					class="absolute inset-0"
					in:fly={{ y: 300, duration: 400 }}
					out:fade={{ duration: 200 }}
				>
					<RushCard
						isLimitOrderNo={isNullish(market.bestBid)}
						isLimitOrderYes={isNullish(market.bestAsk)}
						{market}
						onAction={handleAction}
						signedIn={nonNullish($userStore.user)}
					/>
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

	<!-- Notifications -->
	<div
		class="pointer-events-none fixed bottom-8 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4"
	>
		{#each notifications as notification (notification.id)}
			<div
				class="pointer-events-auto flex w-full items-start gap-3 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-200"
				in:fly={{ y: 20, duration: 300 }}
				out:fade={{ duration: 200 }}
			>
				{#if notification.type === 'error'}
					<div
						class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600"
					>
						<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								d="M6 18L18 6M6 6l12 12"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="3"
							/>
						</svg>
					</div>
				{:else}
					<div
						class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
					>
						<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								d="M5 13l4 4L19 7"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="3"
							/>
						</svg>
					</div>
				{/if}
				<div class="flex flex-col">
					<span class="text-sm font-black text-slate-900">{notification.title}</span>
					<p class="text-xs text-slate-500">{notification.message}</p>
				</div>
			</div>
		{/each}
	</div>
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
			advance();
		}
	}}
/>
