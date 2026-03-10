<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import RushCard from '$lib/components/market/RushCard.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { getRushQueue } from '$lib/services/market.services';
	import { placeOrder } from '$lib/services/order.services';
	import type { Market } from '$lib/types/market';

	const MAX_BETS = 10;
	const MAX_MARKETS = 20;

	let markets = $state<Market[]>([]);

	let currentIndex = $state(0);

	let loading = $state(true);

	let processing = $state(false);

	let tradeAmount = $state('0.1');

	let betsCount = $state(0);

	let completed = $state(false);

	onMount(async () => {
		try {
			const queue = await getRushQueue();

			markets = queue.slice(0, MAX_MARKETS);
		} catch (e) {
			console.error('Failed to load Rush queue', e);
		} finally {
			loading = false;
		}
	});

	const handleAction = async (action: 'YES' | 'NO' | 'SKIP') => {
		if (processing || completed) {
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

		processing = true;
		try {
			const decimals = BigInt(currentMarket.token.decimals);
			const amountE8 = BigInt(Math.floor(parseFloat(tradeAmount) * Number(10n ** decimals)));

			// Use best execution price if available, otherwise fallback to probability
			let price: number;
			if (action === 'YES') {
				price = currentMarket.bestAsk ?? currentMarket.yesProbability;
			} else {
				// For NO, we want to Buy the "NO" side, which is equivalent to Selling "YES" at bestBid
				// bestBid is the price for YES, so 1 - bestBid is the price for NO.
				price =
					currentMarket.bestBid !== undefined
						? 1 - currentMarket.bestBid
						: currentMarket.noProbability;
			}

			// qty = amount / price (normalized to token decimals)
			// Safety: Ensure price is not zero to avoid division by zero
			const executionPrice = Math.max(price, 0.01);
			const qty =
				(amountE8 * 10n ** decimals) / BigInt(Math.floor(executionPrice * Number(10n ** decimals)));

			await placeOrder({
				marketId: currentMarket.id,
				side: 'BUY',
				type: 'LIMIT',
				price: executionPrice,
				qty,
				outcome: action
			});

			betsCount += 1;

			advance();
		} catch (e) {
			console.error('Trade failed', e);
			alert(`Trade failed: ${(e as Error).message}`);
		} finally {
			processing = false;
		}
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
</div>

<svelte:window
	onkeydown={(e) => {
		if (loading || processing || completed) {
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
