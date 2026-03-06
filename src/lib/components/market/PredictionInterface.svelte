<script lang="ts">
	import { onMount } from 'svelte';
	import SignInActions from '$lib/components/authn/SignInActions.svelte';
	import { routeSide } from '$lib/derived/nav.derived';
	import { userSignedIn } from '$lib/derived/user.derived';
	import { placeOrder } from '$lib/services/order.services';
	import { getBalances } from '$lib/services/wallet.service';
	import { tradeStore } from '$lib/stores/trade.store';
	import type { Market, Outcome } from '$lib/types/market';
	import type { OrderType } from '$lib/types/order';
	import type { PositionType } from '$lib/types/position';

	interface Props {
		market: Market;
		onPredictionPlaced: () => void;
	}

	const { market, onPredictionPlaced }: Props = $props();

	const { yesProbability, noProbability } = $derived(market);

	let amount = $state('');

	let price = $state('');

	let selectedType = $state<PositionType>('YES');

	let orderType = $state<OrderType>('MARKET');

	let loading = $state(false);

	let collateral = $state<bigint | undefined>();

	let error = $state('');

	onMount(async () => {
		const balances = await getBalances();

		({ collateral } = balances);
	});

	$effect(() => {
		if ($tradeStore.selectedPrice !== undefined) {
			price = $tradeStore.selectedPrice.toString();
			orderType = 'LIMIT';
		}
	});

	$effect(() => {
		if ($routeSide === 'yes' || $routeSide === 'no') {
			selectedType = $routeSide.toUpperCase() as PositionType;
			if (orderType === 'MARKET') {
				price = (selectedType === 'YES' ? yesProbability : noProbability).toString();
			}
		}
	});

	const handlePlacePrediction = async () => {
		if (!amount || parseFloat(amount) <= 0) {
			error = 'Please enter a valid amount';

			return;
		}

		if (orderType === 'LIMIT' && (!price || parseFloat(price) <= 0 || parseFloat(price) > 1)) {
			error = 'Please enter a valid price between 0 and 1';

			return;
		}

		loading = true;

		error = '';

		try {
			const currentPrice =
				orderType === 'LIMIT'
					? parseFloat(price)
					: selectedType === 'YES'
						? yesProbability
						: noProbability;

			if (currentPrice === 0 || currentPrice === 1 || isNaN(currentPrice)) {
				throw new Error(`Invalid price: outcome probability is ${currentPrice}`);
			}

			const parsedAmount = BigInt(amount);

			await placeOrder({
				marketId: market.id,
				side: 'BUY', // We are always "Buying" an outcome
				type: orderType,
				price: currentPrice,
				qty: parsedAmount,
				outcome: selectedType as Outcome
			});

			amount = '';

			onPredictionPlaced();

			alert(`Successfully placed ${orderType} ${selectedType} order!`);
		} catch (err: unknown) {
			error = (err as Error).message ?? 'Failed to place prediction';
		} finally {
			loading = false;
		}
	};

	const estimatedPayout = $derived(() => {
		if (!amount) {
			return 0;
		}

		const amt = parseFloat(amount);

		const prob =
			orderType === 'LIMIT'
				? parseFloat(price)
				: selectedType === 'YES'
					? yesProbability
					: noProbability;

		if (!prob || prob === 0) {
			return 0;
		}

		return (amt / prob).toFixed(2);
	});
</script>

<div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
	<h3 class="text-xl font-bold text-slate-950">Trade</h3>

	<!-- Order Type Toggle -->
	<div class="mt-4 flex rounded-xl bg-slate-100 p-1">
		<button
			class="flex-1 rounded-lg py-2 text-xs font-bold transition-all {orderType === 'MARKET'
				? 'bg-white text-indigo-600 shadow-sm'
				: 'text-slate-500 hover:text-slate-700'}"
			onclick={() => (orderType = 'MARKET')}
		>
			Market
		</button>
		<button
			class="flex-1 rounded-lg py-2 text-xs font-bold transition-all {orderType === 'LIMIT'
				? 'bg-white text-indigo-600 shadow-sm'
				: 'text-slate-500 hover:text-slate-700'}"
			onclick={() => (orderType = 'LIMIT')}
		>
			Limit
		</button>
	</div>

	<div class="mt-6 space-y-6">
		<!-- Outcome Selector -->
		<div class="grid grid-cols-2 gap-4">
			<button
				class="group relative overflow-hidden rounded-2xl border-2 px-6 py-4 transition-all {selectedType ===
				'YES'
					? 'border-green-500 bg-green-50 text-green-700'
					: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
				onclick={() => {
					selectedType = 'YES';
					if (orderType === 'MARKET') {
						price = yesProbability.toString();
					}
				}}
			>
				<div class="relative z-10 flex flex-col items-center gap-1">
					<span class="text-[10px] font-bold tracking-widest uppercase">Predict</span>
					<span class="text-xl font-black">YES</span>
					{#if orderType === 'MARKET'}
						<span class="text-[10px] font-medium opacity-60"
							>{(yesProbability * 100).toFixed(1)}%</span
						>
					{/if}
				</div>
			</button>

			<button
				class="group relative overflow-hidden rounded-2xl border-2 px-6 py-4 transition-all {selectedType ===
				'NO'
					? 'border-red-500 bg-red-50 text-red-700'
					: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
				onclick={() => {
					selectedType = 'NO';
					if (orderType === 'MARKET') {
						price = noProbability.toString();
					}
				}}
			>
				<div class="relative z-10 flex flex-col items-center gap-1">
					<span class="text-[10px] font-bold tracking-widest uppercase">Predict</span>
					<span class="text-xl font-black">NO</span>
					{#if orderType === 'MARKET'}
						<span class="text-[10px] font-medium opacity-60"
							>{(noProbability * 100).toFixed(1)}%</span
						>
					{/if}
				</div>
			</button>
		</div>

		<!-- Inputs -->
		<div class="space-y-4">
			{#if orderType === 'LIMIT'}
				<div class="space-y-2">
					<label class="text-[10px] font-bold tracking-widest text-slate-400 uppercase" for="price"
						>Limit Price</label
					>
					<div class="relative">
						<input
							id="price"
							class="w-full rounded-2xl border-none bg-slate-50 px-6 py-4 text-xl font-bold text-slate-950 ring-1 ring-slate-200 transition-all ring-inset focus:bg-white focus:ring-2 focus:ring-indigo-500"
							max="1"
							min="0"
							placeholder="0.50"
							step="0.01"
							type="number"
							bind:value={price}
						/>
						<div class="absolute top-1/2 right-4 -translate-y-1/2 text-xs font-bold text-slate-400">
							ICP
						</div>
					</div>
				</div>
			{/if}

			<div class="space-y-2">
				<div class="flex justify-between">
					<label class="text-[10px] font-bold tracking-widest text-slate-400 uppercase" for="amount"
						>Order Size</label
					>
					<span class="text-[10px] font-bold text-slate-400 uppercase">
						Available: {collateral !== undefined
							? (Number(collateral) / 100_000_000).toFixed(2)
							: '...'} ICP
					</span>
				</div>
				<div class="relative">
					<input
						id="amount"
						class="w-full rounded-2xl border-none bg-slate-50 px-6 py-4 text-xl font-bold text-slate-950 ring-1 ring-slate-200 transition-all ring-inset focus:bg-white focus:ring-2 focus:ring-indigo-500"
						placeholder="0.00"
						type="number"
						bind:value={amount}
					/>
					<div class="absolute top-1/2 right-4 -translate-y-1/2 text-xs font-bold text-slate-400">
						ICP
					</div>
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
				<span class="font-medium text-slate-500">Estimated Shares</span>
				<span class="font-bold text-slate-950">{estimatedPayout()} Units</span>
			</div>
			<div class="flex justify-between text-xs">
				<span class="font-medium text-slate-500">Potential Return</span>
				<span class="font-bold text-green-500">
					{amount
						? (
								(parseFloat(estimatedPayout().toString()) / parseFloat(amount || '1') - 1) *
								100
							).toFixed(1)
						: 0}%
				</span>
			</div>
		</div>

		{#if $userSignedIn}
			<button
				class="group relative w-full overflow-hidden rounded-2xl bg-indigo-600 py-5 text-lg font-black text-white shadow-xl shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
				disabled={loading || !amount}
				onclick={handlePlacePrediction}
			>
				{#if loading}
					<div class="flex items-center justify-center gap-2">
						<div
							class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
						></div>
						Processing...
					</div>
				{:else}
					Place {orderType} Order
				{/if}
			</button>
		{:else}
			<div class="flex flex-col items-center gap-4 rounded-2xl bg-indigo-50 p-6 text-center">
				<p class="text-sm font-medium text-indigo-900">Sign in to trade</p>
				<SignInActions />
			</div>
		{/if}
	</div>
</div>
