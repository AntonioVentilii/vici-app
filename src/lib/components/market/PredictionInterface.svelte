<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import SignInActions from '$lib/components/authn/SignInActions.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { VXP_STAKE_STEP_VXP } from '$lib/constants/vxp-trade.constants';
	import { routeSide } from '$lib/derived/nav.derived';
	import { playgroundVxpUnitMode } from '$lib/derived/playground.derived';
	import { walletUiTokens } from '$lib/derived/tokens.derived';
	import { userSignedIn } from '$lib/derived/user.derived';
	import { getOrderBook } from '$lib/services/order.services';
	import { getBalances } from '$lib/services/wallet.service';
	import { collateralsStore } from '$lib/stores/collaterals.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { orderBookStore } from '$lib/stores/order-book.store';
	import { tradeStore } from '$lib/stores/trade.store';
	import { userStore } from '$lib/stores/user.store';
	import type { Market } from '$lib/types/market';
	import type { OrderType } from '$lib/types/order';
	import type { PositionType } from '$lib/types/position';
	import { icrcLedgerDecimalsFromCollateralConfig } from '$lib/utils/asset-ref.utils';
	import { isViciXp } from '$lib/utils/balance-domain.utils';
	import { formatCurrency } from '$lib/utils/format.utils';
	import { calculateMarketStats } from '$lib/utils/market.utils';
	import { parseToken } from '$lib/utils/parse.utils';
	import {
		formatAvailableMarginForUi,
		intuitiveAvailableMarginUsd,
		nativeToClearingMarginUnits,
		quickBetChipLabel
	} from '$lib/utils/playground-display.utils';
	import {
		assertViciXpHumanPremiumAndPayout,
		executeOutcomeTrade,
		resolveOutcomeExecutionPriceForSizing
	} from '$lib/utils/trade.utils';

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
		if (nonNullish(initialType)) {
			selectedType = initialType;
		}
	});

	let orderType = $state<OrderType>('MARKET');

	let loading = $state(false);

	let error = $state('');

	let availableEquity = $derived.by(() => {
		if (isNullish($collateralsStore)) {
			return ZERO;
		}

		const a = $collateralsStore.accountState;

		if (isNullish(a)) {
			return ZERO;
		}

		let fallback = ZERO;

		for (const t of $walletUiTokens) {
			const b = $collateralsStore?.balances[t.id] ?? ZERO;

			if (b > ZERO) {
				const d = icrcLedgerDecimalsFromCollateralConfig({
					assetsConfig: $collateralsStore?.assetsConfig ?? {},
					ledgerCanisterId: t.ledgerCanisterId,
					fallbackDecimals: t.decimals
				});
				fallback += nativeToClearingMarginUnits({
					nativeBalance: b,
					nativeDecimals: d
				});
			}
		}

		return intuitiveAvailableMarginUsd({
			assets: a.assets,
			totalEquityUsd: a.total_equity_usd,
			availableMarginUsd: a.available_margin_usd,
			fallbackCollateralMarginUnits: fallback
		});
	});

	const fetchOrderBook = async () => {
		try {
			const orderBook = await getOrderBook({
				marketId: market.id,
				domain: market.balanceDomain
			});

			orderBookStore.update((state) => ({
				...state,
				[market.id]: orderBook
			}));
		} catch (err) {
			console.error('Failed to fetch order book', err);
		}
	};

	const fetchBalance = async () => {
		if (!$userSignedIn) {
			return;
		}

		try {
			const { collateral, accountState } = await getBalances(market.balanceDomain);

			collateralsStore.update((state) => ({
				balances: collateral,
				accountState,
				assetsConfig: state?.assetsConfig ?? {}
			}));
		} catch (err) {
			console.error('Failed to fetch balance', err);
		}
	};

	onMount(() => {
		fetchOrderBook();

		if ($userSignedIn) {
			fetchBalance();
		}

		// Set default amount from profile if empty
		if (!amount && $userStore.profile?.preferences?.defaultAmount?.manual) {
			const pref = $userStore.profile.preferences.defaultAmount.manual;

			amount =
				get(playgroundVxpUnitMode) && Number(pref) < VXP_STAKE_STEP_VXP
					? String(VXP_STAKE_STEP_VXP)
					: pref;
		}

		const interval = setInterval(fetchOrderBook, 5_000);

		return () => clearInterval(interval);
	});

	$effect(() => {
		if (nonNullish(selectedType)) {
			fetchOrderBook();
		}
	});

	$effect(() => {
		if (nonNullish($tradeStore.selectedPrice)) {
			// Convert decimal (0.35) to percentage (35)
			price = Math.round($tradeStore.selectedPrice * 100).toString();

			orderType = 'LIMIT';
		}
	});

	const vxpQuickAmounts = ['100', '200', '500', '1000'] as const;
	const settlementQuickAmounts = ['1', '10', '50', '100'] as const;

	let quickBetAmounts = $derived(
		$playgroundVxpUnitMode ? [...vxpQuickAmounts] : [...settlementQuickAmounts]
	);

	let marketDepth = $derived.by(() => {
		const rawOrders = $orderBookStore?.[market.id];

		if (!rawOrders) {
			return;
		}

		return calculateMarketStats({ orders: rawOrders, outcome: selectedType });
	});

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

	const handleOutcomeSelect = ({
		outcomeId,
		probability
	}: {
		outcomeId: string;
		probability?: number;
	}) => {
		selectedType = outcomeId;

		if (nonNullish(probability) && orderType === 'MARKET') {
			price = Math.round(probability * 100).toString();
		} else if (isNullish(probability)) {
			price = '';
		}
	};

	const handlePlacePrediction = async () => {
		if (isNullish(amount) || parseFloat(amount) <= 0) {
			error = 'Please enter a valid amount';

			return;
		}

		if (
			orderType === 'LIMIT' &&
			(isNullish(price) || parseFloat(price) <= 0 || parseFloat(price) >= 100)
		) {
			error = 'Please enter a valid price between 1 and 99';

			return;
		}

		if (isViciXp(market.balanceDomain)) {
			try {
				const limitPrice = orderType === 'LIMIT' ? parseFloat(price) / 100 : undefined;
				assertViciXpHumanPremiumAndPayout({
					amountStr: String(amount),
					executionPrice: resolveOutcomeExecutionPriceForSizing({
						market,
						action: selectedType,
						orderType,
						limitPrice
					})
				});
			} catch (e) {
				error = (e as Error).message ?? 'Invalid VXP amount';

				return;
			}
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
			fetchBalance();

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
		if (isNullish(amount)) {
			return '-';
		}

		const amt = parseFloat(amount);

		if (isNaN(amt) || amt <= 0) {
			return '-';
		}

		const cost = parseToken({ value: String(amount), unitName: market.token.decimals });

		return formatCurrency({
			value: cost,
			decimals: market.token.decimals,
			symbol: market.token.symbol
		});
	});

	const estimatedPayout = $derived.by(() => {
		if (isNullish(amount)) {
			return '-';
		}

		const amt = parseFloat(amount);

		if (isNaN(amt) || amt <= 0) {
			return '-';
		}

		const prob =
			orderType === 'LIMIT'
				? parseFloat(price) / 100
				: selectedType === 'YES'
					? yesProbability
					: selectedType === 'NO'
						? noProbability
						: (marketDepth?.midPrice ?? 0.5);

		if (!Number.isFinite(prob) || prob <= 0) {
			return '-';
		}

		const payoutRaw = amt / prob;

		if (!Number.isFinite(payoutRaw) || payoutRaw < 0) {
			return '-';
		}

		const payout = parseToken({
			value: payoutRaw.toFixed(market.token.decimals),
			unitName: market.token.decimals
		});

		return formatCurrency({
			value: payout,
			decimals: market.token.decimals,
			symbol: market.token.symbol
		});
	});

	const potentialReturnPercent = $derived.by(() => {
		if (isNullish(amount)) {
			return 0;
		}

		const amt = parseFloat(amount);

		if (isNaN(amt) || amt <= 0) {
			return 0;
		}

		const prob =
			orderType === 'LIMIT'
				? parseFloat(price) / 100
				: selectedType === 'YES'
					? yesProbability
					: selectedType === 'NO'
						? noProbability
						: (marketDepth?.midPrice ?? 0.5);

		if (!Number.isFinite(prob) || prob <= 0) {
			return 0;
		}

		return (1 / prob) * 100;
	});
</script>

<div class="border-border bg-card rounded-3xl border p-6">
	<!-- Order Type Toggle -->
	<div class="bg-foreground/5 flex rounded-xl p-1">
		<BaseButton
			class="flex-1 rounded-lg py-2 text-xs font-bold {orderType === 'MARKET'
				? 'bg-card text-primary shadow-sm'
				: 'text-muted-foreground hover:text-foreground'}"
			onclick={() => (orderType = 'MARKET')}
			status={hasMarketDepth ? 'enabled' : 'disabled'}
			title={!hasMarketDepth ? 'No liquidity for instant prediction' : ''}
		>
			Instant
		</BaseButton>

		<BaseButton
			class="flex-1 rounded-lg py-2 text-xs font-bold {orderType === 'LIMIT'
				? 'bg-card text-primary shadow-sm'
				: 'text-muted-foreground hover:text-foreground'}"
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
							? 'border-yes bg-yes-wash text-yes'
							: 'border-border bg-foreground/5 text-muted-foreground hover:border-foreground/10'}"
						onclick={() => handleOutcomeSelect({ outcomeId: 'YES', probability: yesProbability })}
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
							? 'border-destructive bg-destructive/10 text-destructive'
							: 'border-border bg-foreground/5 text-muted-foreground hover:border-foreground/10'}"
						onclick={() => handleOutcomeSelect({ outcomeId: 'NO', probability: noProbability })}
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
									? 'border-primary bg-primary/10 text-primary'
									: 'border-border bg-foreground/5 text-muted-foreground hover:border-foreground/10'}"
								onclick={() => handleOutcomeSelect({ outcomeId: outcome.id })}
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
					<label
						class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase"
						for="price"
					>
						Target Probability
					</label>

					<div class="relative">
						<input
							id="price"
							class="bg-foreground/5 text-foreground ring-border focus:bg-card focus:ring-primary w-full rounded-2xl border-none px-6 py-4 text-xl font-bold ring-1 transition-all ring-inset focus:ring-2"
							max={99}
							min={1}
							placeholder="50"
							step={1}
							type="number"
							bind:value={price}
						/>
						<div
							class="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2 text-xs font-bold"
						>
							%
						</div>
					</div>
				</div>
			{/if}

			<div class="space-y-2">
				<div class="flex justify-between">
					<label
						class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase"
						for="amount"
					>
						Investment Amount ({market.token.symbol})
					</label>

					<span class="text-muted-foreground text-[10px] font-bold uppercase">
						Available: {nonNullish(availableEquity)
							? formatAvailableMarginForUi({
									value: availableEquity,
									playground: $playgroundVxpUnitMode
								})
							: '...'}
					</span>
				</div>

				<div class="relative">
					<input
						id="amount"
						class="bg-foreground/5 text-foreground ring-border focus:bg-card focus:ring-primary w-full rounded-2xl border-none py-4 pr-16 pl-6 text-xl font-bold ring-1 transition-all ring-inset focus:ring-2"
						max="10000000"
						min={$playgroundVxpUnitMode ? VXP_STAKE_STEP_VXP : 0}
						placeholder="0"
						step={$playgroundVxpUnitMode ? VXP_STAKE_STEP_VXP : 1}
						type="number"
						bind:value={amount}
					/>
					<div
						class="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2 text-xs font-bold"
					>
						{market.token.symbol}
					</div>
				</div>

				<!-- Quick Amounts -->
				<div class="flex gap-2">
					{#each quickBetAmounts as quickAmount (quickAmount)}
						<BaseButton
							class="border-border bg-foreground/5 text-muted-foreground hover:border-primary/30 hover:bg-card hover:text-primary flex-1 rounded-xl border py-2 text-[10px] font-bold transition-all"
							onclick={() => (amount = quickAmount)}
						>
							{quickBetChipLabel({
								amount: quickAmount,
								playground: $playgroundVxpUnitMode
							})}
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
		{:else if availableEquity === ZERO && $userSignedIn}
			<div
				class="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs font-medium text-amber-700"
			>
				You have no <strong>Buying Power</strong> in the
				<span class="font-bold">{Object.keys(market.balanceDomain)[0]}</span> domain.
				<a class="ml-1 font-bold text-amber-900 underline hover:no-underline" href="/wallet">
					Deposit collateral in the Wallet
				</a>
			</div>
		{/if}

		<!-- Payout Summary -->
		<div class="bg-foreground/5 space-y-3 rounded-2xl p-5">
			<div class="flex justify-between text-xs">
				<span class="text-muted-foreground font-medium">Estimated Cost</span>

				<span class="text-foreground font-bold">{estimatedCost}</span>
			</div>

			<div class="flex justify-between text-xs">
				<span class="text-muted-foreground font-medium">Potential Return</span>

				<span class="text-yes font-bold">
					{estimatedPayout} ({potentialReturnPercent.toFixed(1)}%)
				</span>
			</div>
		</div>

		{#if $userSignedIn}
			<Button
				class="w-full py-5 text-lg font-black"
				onclick={handlePlacePrediction}
				status={loading
					? 'pending'
					: !isNullish(amount) && parseFloat(amount) > 0
						? 'enabled'
						: 'disabled'}
			>
				{#snippet busyLabel()}
					Confirming...
				{/snippet}
				Confirm {selectedType}
			</Button>
		{:else}
			<div class="bg-primary/10 flex flex-col items-center gap-4 rounded-2xl p-6 text-center">
				<p class="text-primary text-sm font-medium">Sign in to trade</p>
				<SignInActions />
			</div>
		{/if}
	</div>
</div>
