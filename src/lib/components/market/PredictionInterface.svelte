<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { resolve } from '$app/paths';
	import SignInActions from '$lib/components/authn/SignInActions.svelte';
	import IconSignalNo from '$lib/components/icons/IconSignalNo.svelte';
	import IconSignalYes from '$lib/components/icons/IconSignalYes.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { ORDER_BOOK_POLL_MS, ZERO } from '$lib/constants/app.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { VXP_STAKE_STEP_VXP } from '$lib/constants/vxp-trade.constants';
	import { routeSide } from '$lib/derived/nav.derived';
	import { playgroundVxpUnitMode } from '$lib/derived/playground.derived';
	import { walletUiTokens } from '$lib/derived/tokens.derived';
	import { userSignedIn } from '$lib/derived/user.derived';
	import { getOrderBook } from '$lib/services/order.services';
	import { getBalances } from '$lib/services/wallet.service';
	import { collateralsStore } from '$lib/stores/collaterals.store';
	import { localeStore } from '$lib/stores/locale.store';
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
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
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

	const tr = ({ key, params }: { key: MessageKey; params?: Record<string, string | number> }) =>
		t({ locale: $localeStore, key, params });

	let amount = $state('');

	let price = $state('');

	let selectedType = $state<PositionType>('YES');

	$effect(() => {
		if (nonNullish(initialType)) {
			selectedType = initialType;
		}
	});

	let orderType = $state<OrderType>('MARKET');

	let orderTypeLabel = $derived(
		orderType === 'MARKET'
			? tr({ key: 'prediction.order.instant' })
			: tr({ key: 'prediction.order.set_price' })
	);

	let selectedOutcomeLabel = $derived.by(() => {
		if (selectedType === 'YES') {
			return tr({ key: 'outcome.yes' });
		}

		if (selectedType === 'NO') {
			return tr({ key: 'outcome.no' });
		}

		return market.outcomes?.find((outcome) => outcome.id === selectedType)?.title ?? selectedType;
	});

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
		} catch (err: unknown) {
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
		} catch (err: unknown) {
			console.error('Failed to fetch balance', err);
		}
	};

	onMount(() => {
		fetchOrderBook();

		if ($userSignedIn) {
			fetchBalance();
		}

		if (!amount && $userStore.profile?.preferences?.defaultAmount?.manual) {
			const pref = $userStore.profile.preferences.defaultAmount.manual;

			amount =
				get(playgroundVxpUnitMode) && Number(pref) < VXP_STAKE_STEP_VXP
					? String(VXP_STAKE_STEP_VXP)
					: pref;
		}

		const interval = setInterval(fetchOrderBook, ORDER_BOOK_POLL_MS);

		return () => clearInterval(interval);
	});

	$effect(() => {
		if (nonNullish(selectedType)) {
			fetchOrderBook();
		}
	});

	$effect(() => {
		if (nonNullish($tradeStore.selectedPrice)) {
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
			error = tr({ key: 'prediction.error.invalid_amount' });

			return;
		}

		if (
			orderType === 'LIMIT' &&
			(isNullish(price) || parseFloat(price) <= 0 || parseFloat(price) >= 100)
		) {
			error = tr({ key: 'prediction.error.invalid_price' });

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
			} catch (e: unknown) {
				error = (e as Error).message ?? tr({ key: 'prediction.error.invalid_vxp' });

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
				title: tr({ key: 'prediction.notification.title' }),
				message: tr({
					key: 'prediction.notification.message',
					params: {
						orderType: orderTypeLabel,
						side: selectedOutcomeLabel
					}
				}),
				type: 'success'
			});
		} catch (err: unknown) {
			error = (err as Error).message ?? tr({ key: 'prediction.error.failed' });
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

<div class="prediction-panel">
	<div class="prediction-order-toggle">
		<BaseButton
			class="flex-1 rounded-lg py-2 text-xs font-bold {orderType === 'MARKET'
				? 'bg-card text-primary shadow-sm'
				: 'text-muted-foreground hover:text-foreground'}"
			onclick={() => (orderType = 'MARKET')}
			status={hasMarketDepth ? 'enabled' : 'disabled'}
			title={!hasMarketDepth ? tr({ key: 'prediction.no_liquidity_title' }) : ''}
		>
			{tr({ key: 'prediction.order.instant' })}
		</BaseButton>

		<BaseButton
			class="flex-1 rounded-lg py-2 text-xs font-bold {orderType === 'LIMIT'
				? 'bg-card text-primary shadow-sm'
				: 'text-muted-foreground hover:text-foreground'}"
			onclick={() => (orderType = 'LIMIT')}
		>
			{tr({ key: 'prediction.order.set_price' })}
		</BaseButton>
	</div>

	<div class="mt-6 space-y-6">
		{#if !hideSelector}
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
							<IconSignalYes size="22px" />
							<span class="eyebrow-xs">
								{tr({ key: 'prediction.choice.label' })}
							</span>
							<span class="text-xl font-black">{tr({ key: 'outcome.yes' })}</span>
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
							<IconSignalNo size="22px" />
							<span class="eyebrow-xs">
								{tr({ key: 'prediction.choice.label' })}
							</span>
							<span class="text-xl font-black">{tr({ key: 'outcome.no' })}</span>
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
									<span class="eyebrow-xs">
										{tr({ key: 'prediction.choice.label' })}
									</span>
									<span class="text-center text-sm font-black">{outcome.title}</span>
								</div>
							</BaseButton>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<div class="space-y-4">
			{#if orderType === 'LIMIT'}
				<div class="space-y-2">
					<label class="text-muted-foreground eyebrow-xs" for="price">
						{tr({ key: 'prediction.target_probability' })}
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
					<label class="text-muted-foreground eyebrow-xs" for="amount">
						{tr({
							key: 'prediction.investment_amount',
							params: { symbol: market.token.symbol }
						})}
					</label>

					<span class="text-muted-foreground text-[10px] font-bold uppercase">
						{tr({
							key: 'prediction.available',
							params: {
								amount: nonNullish(availableEquity)
									? formatAvailableMarginForUi({
											value: availableEquity,
											playground: $playgroundVxpUnitMode
										})
									: '...'
							}
						})}
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
				class="border-destructive/20 bg-no-wash text-destructive rounded-xl border p-4 text-xs font-medium"
			>
				{error}
			</div>
		{:else if availableEquity === ZERO && $userSignedIn}
			<div
				class="border-warning/20 bg-warning/10 text-foreground rounded-xl border p-4 text-xs font-medium"
			>
				{tr({
					key: 'prediction.no_buying_power',
					params: { domain: Object.keys(market.balanceDomain)[0] ?? '' }
				})}
				<a
					class="text-primary ml-1 font-bold underline hover:no-underline"
					href={resolve(AppPath.Wallet)}
				>
					{tr({ key: 'prediction.deposit_wallet' })}
				</a>
			</div>
		{/if}

		<div class="bg-foreground/5 space-y-3 rounded-2xl p-5">
			<div class="flex justify-between text-xs">
				<span class="text-muted-foreground font-medium"
					>{tr({ key: 'prediction.estimated_cost' })}</span
				>

				<span class="text-foreground font-bold">{estimatedCost}</span>
			</div>

			<div class="flex justify-between text-xs">
				<span class="text-muted-foreground font-medium"
					>{tr({ key: 'prediction.potential_return' })}</span
				>

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
					{tr({ key: 'prediction.confirming' })}
				{/snippet}
				{tr({ key: 'prediction.confirm', params: { side: selectedOutcomeLabel } })}
			</Button>
		{:else}
			<div class="bg-primary/10 flex flex-col items-center gap-4 rounded-2xl p-6 text-center">
				<p class="text-primary text-sm font-medium">{tr({ key: 'prediction.sign_in' })}</p>
				<SignInActions />
			</div>
		{/if}
	</div>
</div>

<style lang="postcss">
	.prediction-panel {
		border: 1px solid var(--border-base);
		border-radius: 1.5rem;
		background:
			radial-gradient(circle at 18% 0%, var(--laurel-glow), transparent 34%),
			linear-gradient(180deg, var(--bg-popover), var(--bg-surface));
		box-shadow: var(--shadow-card);
		padding: 1rem;
	}

	.prediction-order-toggle {
		display: flex;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		padding: 0.25rem;
	}

	@media (min-width: 640px) {
		.prediction-panel {
			padding: 1.25rem;
		}
	}
</style>
