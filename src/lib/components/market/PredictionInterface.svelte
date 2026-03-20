<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import { onMount } from 'svelte';
	import SignInActions from '$lib/components/authn/SignInActions.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { routeSide } from '$lib/derived/nav.derived';
	import { userSignedIn } from '$lib/derived/user.derived';
	import { getOrderBook } from '$lib/services/order.services';
	import { collateralsStore } from '$lib/stores/collaterals.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { orderBookStore } from '$lib/stores/order-book.store';
	import { tradeStore } from '$lib/stores/trade.store';
	import { userStore } from '$lib/stores/user.store';
	import type { Market } from '$lib/types/market';
	import type { OrderType } from '$lib/types/order';
	import type { PositionType } from '$lib/types/position';
	import { formatAvailableUsd, formatCurrency } from '$lib/utils/format.utils';
	import { executeOutcomeTrade } from '$lib/utils/trade.utils';

	interface Props {
		market: Market;
		onPredictionPlaced: () => void;
		initialType?: PositionType;
		hideSelector?: boolean;
	}

	const { market, onPredictionPlaced, initialType, hideSelector = false }: Props = $props();

	const { yesProbability, noProbability } = $derived(market);

	let amount = $state('');

	let price = $state(''); // This will now hold percentage (e.g., "35")

	let selectedType = $state<PositionType>('YES');

	$effect(() => {
		if (initialType) {
			selectedType = initialType;
		}
	});

	let orderType = $state<OrderType>('MARKET');

	let loading = $state(false);

	let error = $state('');

	let availableEquity = $derived($collateralsStore.accountState?.available_margin_usd ?? ZERO);

	const fetchOrderBook = async () => {
		try {
			const orderBook = await getOrderBook({ marketId: market.id, outcomeId: selectedType });

			orderBookStore.update((state) => ({
				...state,
				[market.id]: orderBook
			}));
		} catch (err) {
			console.error('Failed to fetch order book', err);
		}
	};

	onMount(() => {
		fetchOrderBook();

		// Set default amount from profile if empty
		if (!amount && $userStore.profile?.preferences?.defaultAmount?.manual) {
			amount = $userStore.profile.preferences.defaultAmount.manual;
		}

		const interval = setInterval(fetchOrderBook, 5_000);

		return () => clearInterval(interval);
	});

	$effect(() => {
		if (nonNullish($tradeStore.selectedPrice)) {
			// Convert decimal (0.35) to percentage (35)
			price = Math.round($tradeStore.selectedPrice * 100).toString();

			orderType = 'LIMIT';
		}
	});

	let marketDepth = $derived($orderBookStore?.[market.id]);

	let hasMarketDepth = $derived.by(() => {
		if (!marketDepth) {
			return false;
		}

		// To buy YES, we need ASKS (Sell YES orders)
		if (selectedType === 'YES') {
			return marketDepth.asks.length > 0;
		}

		// To buy NO, we need BIDS (Buy YES orders)
		return marketDepth.bids.length > 0;
	});

	$effect(() => {
		if (!hasMarketDepth && orderType === 'MARKET') {
			orderType = 'LIMIT';
		}
	});

	$effect(() => {
		if ($routeSide) {
			const sideParam = $routeSide;
			const isBinarySide = sideParam.toUpperCase() === 'YES' || sideParam.toUpperCase() === 'NO';
			selectedType = isBinarySide ? sideParam.toUpperCase() : sideParam;

			if (orderType === 'MARKET') {
				// For binary, we have yes/noProb. For categorical, we might need to find it in market.outcomes
				if (isBinarySide) {
					price = Math.round(
						(selectedType === 'YES' ? yesProbability : noProbability) * 100
					).toString();
				} else {
					const outcome = market.outcomes?.find((o) => o.id === selectedType);
					if (outcome?.probability) {
						price = Math.round(outcome.probability * 100).toString();
					}
				}
			}
		}
	});

	const handlePlacePrediction = async () => {
		if (!amount || parseFloat(amount) <= 0) {
			error = 'Please enter a valid amount';

			return;
		}

		if (orderType === 'LIMIT' && (!price || parseFloat(price) <= 0 || parseFloat(price) >= 100)) {
			error = 'Please enter a valid price between 1 and 99';

			return;
		}

		loading = true;

		error = '';

		try {
			const limitPrice = orderType === 'LIMIT' ? parseFloat(price) / 100 : undefined;

			await executeOutcomeTrade({
				market,
				action: selectedType,
				amount,
				orderType,
				limitPrice
			});

			amount = '';

			onPredictionPlaced();

			notificationsStore.add({
				title: 'Order Placed',
				message: `Successfully placed ${orderType} ${selectedType} order!`,
				type: 'success'
			});
		} catch (err: unknown) {
			error = (err as Error).message ?? 'Failed to place prediction';
		} finally {
			loading = false;
		}
	};

	const estimatedCost = $derived.by(() => {
		if (!amount) {
			return '-';
		}

		const amt = parseFloat(amount);

		const prob =
			orderType === 'LIMIT'
				? parseFloat(price) / 100
				: selectedType === 'YES'
					? yesProbability
					: selectedType === 'NO'
						? noProbability
						: (marketDepth?.midPrice ?? 0.5);

		if (!prob || prob === 0) {
			return '0';
		}

		const cost = BigInt(Math.floor(amt * prob * 10 ** 6));
		return formatCurrency({ value: cost, decimals: 6 });
	});

	const estimatedPayout = $derived.by(() => {
		if (!amount) {
			return '-';
		}

		const amt = parseFloat(amount);

		const prob =
			orderType === 'LIMIT'
				? parseFloat(price) / 100
				: selectedType === 'YES'
					? yesProbability
					: selectedType === 'NO'
						? noProbability
						: (marketDepth?.midPrice ?? 0.5);

		if (!prob || prob === 0) {
			return '0';
		}

		const payout = BigInt(Math.floor(amt * (1 - prob) * 10 ** 6));
		return formatCurrency({ value: payout, decimals: 6 });
	});
</script>

<div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
	<!-- Order Type Toggle -->
	<div class="flex rounded-xl bg-slate-100 p-1">
		<BaseButton
			class="flex-1 rounded-lg py-2 text-xs font-bold {orderType === 'MARKET'
				? 'bg-white text-indigo-600 shadow-sm'
				: 'text-slate-500 hover:text-slate-700'}"
			onclick={() => (orderType = 'MARKET')}
			status={hasMarketDepth ? 'enabled' : 'disabled'}
			title={!hasMarketDepth ? 'No liquidity for instant prediction' : ''}
		>
			Instant
		</BaseButton>

		<BaseButton
			class="flex-1 rounded-lg py-2 text-xs font-bold {orderType === 'LIMIT'
				? 'bg-white text-indigo-600 shadow-sm'
				: 'text-slate-500 hover:text-slate-700'}"
			onclick={() => (orderType = 'LIMIT')}
		>
			Set Price
		</BaseButton>
	</div>

	<div class="mt-6 space-y-6">
		{#if !hideSelector}
			<!-- Outcome Selector -->
			<div class="grid grid-cols-2 gap-4">
				{#if market.payoffType === 'Binary'}
					<BaseButton
						class="group relative overflow-hidden rounded-2xl border-2 px-6 py-4 {selectedType ===
						'YES'
							? 'border-green-500 bg-green-50 text-green-700'
							: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
						onclick={() => {
							selectedType = 'YES';
							if (orderType === 'MARKET') {
								price = Math.round(yesProbability * 100).toString();
							}
						}}
					>
						<div class="relative z-10 flex flex-col items-center gap-1">
							<span class="text-[10px] font-bold tracking-widest uppercase">Predict</span>
							<span class="text-xl font-black">YES</span>
							{#if orderType === 'MARKET'}
								<span class="text-[10px] font-medium opacity-60">
									{(yesProbability * 100).toFixed(1)}%
								</span>
							{/if}
						</div>
					</BaseButton>

					<BaseButton
						class="group relative overflow-hidden rounded-2xl border-2 px-6 py-4 {selectedType ===
						'NO'
							? 'border-red-500 bg-red-50 text-red-700'
							: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
						onclick={() => {
							selectedType = 'NO';
							if (orderType === 'MARKET') {
								price = Math.round(noProbability * 100).toString();
							}
						}}
					>
						<div class="relative z-10 flex flex-col items-center gap-1">
							<span class="text-[10px] font-bold tracking-widest uppercase">Predict</span>
							<span class="text-xl font-black">NO</span>
							{#if orderType === 'MARKET'}
								<span class="text-[10px] font-medium opacity-60">
									{(noProbability * 100).toFixed(1)}%
								</span>
							{/if}
						</div>
					</BaseButton>
				{:else}
					<div class="col-span-2 grid grid-cols-2 gap-3">
						{#each market.outcomes ?? [] as outcome (outcome.id)}
							<BaseButton
								class="group relative overflow-hidden rounded-2xl border-2 px-4 py-4 {selectedType ===
								outcome.id
									? 'border-indigo-600 bg-indigo-50 text-indigo-700'
									: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
								onclick={() => {
									selectedType = outcome.id;
									price = ''; // Reset price on outcome change for now
								}}
							>
								<div class="relative z-10 flex flex-col items-center gap-0.5">
									<span class="text-[10px] font-bold tracking-widest uppercase">Predict</span>
									<span class="text-center text-sm font-black">{outcome.title}</span>
								</div>
							</BaseButton>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Inputs -->
		<div class="space-y-4">
			{#if orderType === 'LIMIT'}
				<div class="space-y-2">
					<label class="text-[10px] font-bold tracking-widest text-slate-400 uppercase" for="price">
						Target Probability
					</label>

					<div class="relative">
						<input
							id="price"
							class="w-full rounded-2xl border-none bg-slate-50 px-6 py-4 text-xl font-bold text-slate-950 ring-1 ring-slate-200 transition-all ring-inset focus:bg-white focus:ring-2 focus:ring-indigo-500"
							max={99}
							min={1}
							placeholder="50"
							step={1}
							type="number"
							bind:value={price}
						/>
						<div class="absolute top-1/2 right-4 -translate-y-1/2 text-xs font-bold text-slate-400">
							%
						</div>
					</div>
				</div>
			{/if}

			<div class="space-y-2">
				<div class="flex justify-between">
					<label
						class="text-[10px] font-bold tracking-widest text-slate-400 uppercase"
						for="amount"
					>
						Order Size (Qty)
					</label>

					<span class="text-[10px] font-bold text-slate-400 uppercase">
						Available: {availableEquity !== undefined
							? formatAvailableUsd({ value: availableEquity })
							: '...'}
					</span>
				</div>

				<div class="relative">
					<input
						id="amount"
						class="w-full rounded-2xl border-none bg-slate-50 py-4 pr-16 pl-6 text-xl font-bold text-slate-950 ring-1 ring-slate-200 transition-all ring-inset focus:bg-white focus:ring-2 focus:ring-indigo-500"
						max="1000"
						min="0"
						placeholder="0"
						step="1"
						type="number"
						bind:value={amount}
					/>
					<div class="absolute top-1/2 right-4 -translate-y-1/2 text-xs font-bold text-slate-400">
						{market.token.symbol}
					</div>
				</div>

				<!-- Quick Amounts -->
				<div class="flex gap-2">
					{#each ['1', '10', '50', '100'] as quickAmount (quickAmount)}
						<BaseButton
							class="flex-1 rounded-xl border border-slate-100 bg-slate-50 py-2 text-[10px] font-bold text-slate-500 transition-all hover:border-indigo-200 hover:bg-white hover:text-indigo-600"
							onclick={() => (amount = quickAmount)}
						>
							${quickAmount}
						</BaseButton>
					{/each}
				</div>
			</div>
		</div>

		{#if error}
			<div
				class="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs font-medium text-red-500"
			>
				{error}
			</div>
		{/if}

		<!-- Payout Summary -->
		<div class="space-y-3 rounded-2xl bg-slate-50 p-5">
			<div class="flex justify-between text-xs">
				<span class="font-medium text-slate-500">Estimated Cost</span>

				<span class="font-bold text-slate-950">{estimatedCost}</span>
			</div>

			<div class="flex justify-between text-xs">
				<span class="font-medium text-slate-500">Potential Return</span>

				<span class="font-bold text-green-500">
					{amount
						? ((parseFloat(estimatedPayout) / parseFloat(estimatedCost)) * 100).toFixed(1)
						: 0}%
				</span>
			</div>
		</div>

		{#if $userSignedIn}
			<Button
				class="w-full py-5 text-lg font-black"
				onclick={handlePlacePrediction}
				status={loading ? 'pending' : nonNullish(amount) ? 'enabled' : 'disabled'}
			>
				Confirm {selectedType}
			</Button>
		{:else}
			<div class="flex flex-col items-center gap-4 rounded-2xl bg-indigo-50 p-6 text-center">
				<p class="text-sm font-medium text-indigo-900">Sign in to trade</p>
				<SignInActions />
			</div>
		{/if}
	</div>
</div>
