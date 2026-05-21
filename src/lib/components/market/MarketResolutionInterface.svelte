<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { PRICE_DECIMALS } from '$lib/constants/app.constants';
	import { settleMarket } from '$lib/services/resolution.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { Market } from '$lib/types/market';
	import { t } from '$lib/utils/i18n.utils';
	import { parseToken } from '$lib/utils/parse.utils';

	interface Props {
		market: Market;
		onSettled: () => void;
	}

	const { market, onSettled }: Props = $props();

	let settlementPrice = $state('');
	let selectedOutcomeId = $state('');
	let loading = $state(false);
	let error = $state('');

	const isExpired = $derived(market.expiryDate < BigInt(Date.now()));
	const isUrgent = $derived(isExpired && market.status !== 'Resolved');
	const isCategorical = $derived(market.payoffType === 'Categorical');

	const handleSettle = async () => {
		if (isCategorical) {
			if (!selectedOutcomeId) {
				error = t({ locale: $localeStore, key: 'market.resolution.error.select_outcome' });

				return;
			}
		} else {
			if (!settlementPrice || parseFloat(settlementPrice) < 0) {
				error = t({ locale: $localeStore, key: 'market.resolution.error.invalid_price' });

				return;
			}
		}

		loading = true;
		error = '';

		try {
			if (isCategorical) {
				await settleMarket({ seriesId: market.id, outcomeId: selectedOutcomeId });
			} else {
				// `settleMarket` expects a bigint already scaled to `PRICE_DECIMALS`
				// (the clearing canister's settlement-price unit). Previously this
				// parsed with `market.token.decimals`, which is the collateral
				// ledger's scale (e.g. 6 for USDC) and does NOT match PRICE_DECIMALS
				// (2). The resulting bigint was off by 10^(token.decimals −
				// PRICE_DECIMALS) and only happened to work for the binary YES/NO
				// path because clearing treats any `price > 0` as YES.
				const price = parseToken({
					value: settlementPrice.trim(),
					unitName: PRICE_DECIMALS
				});
				await settleMarket({ seriesId: market.id, settlementPrice: price });
			}

			onSettled();
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'wallet.send.success_title' }),
				message: t({ locale: $localeStore, key: 'market.resolution.notify.success_message' }),
				type: 'success'
			});
		} catch (e: unknown) {
			error =
				(e as Error).message ?? t({ locale: $localeStore, key: 'market.resolution.error.failed' });
		} finally {
			loading = false;
		}
	};
</script>

<Card padding="lg" variant={isUrgent ? 'default' : 'outline'}>
	<div class="space-y-6">
		{#if isUrgent}
			<div class="flex items-center gap-2">
				<Badge variant="danger"
					>{t({ locale: $localeStore, key: 'market.resolution.urgent_badge' })}</Badge
				>
			</div>
		{/if}

		<div>
			<h3 class="text-foreground text-lg font-black uppercase">
				{t({ locale: $localeStore, key: 'market.resolution.admin_title' })}
			</h3>
			<p class="text-muted-foreground mt-2 text-xs">
				{isCategorical
					? t({ locale: $localeStore, key: 'market.resolution.categorical_sub' })
					: t({ locale: $localeStore, key: 'market.resolution.scalar_sub' })}
			</p>
		</div>

		<div class="space-y-4">
			{#if isCategorical}
				<div class="grid grid-cols-1 gap-2">
					{#each market.outcomes ?? [] as outcome (outcome.id)}
						<button
							class="flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 transition-all {selectedOutcomeId ===
							outcome.id
								? 'border-primary bg-primary/10 text-primary'
								: 'border-border bg-card text-foreground hover:border-foreground/10'}"
							onclick={() => (selectedOutcomeId = outcome.id)}
							type="button"
						>
							<span class="font-bold">{outcome.title}</span>
							{#if selectedOutcomeId === outcome.id}
								<div class="bg-primary h-2 w-2 rounded-full"></div>
							{/if}
						</button>
					{/each}
				</div>
			{:else}
				<div class="space-y-4">
					<div class="flex gap-2">
						<Button
							class="flex-1"
							onclick={() => (settlementPrice = '1.0')}
							size="sm"
							variant={settlementPrice === '1.0' ? 'primary' : 'outline'}
						>
							{t({ locale: $localeStore, key: 'market.resolution.settle_yes' })}
						</Button>
						<Button
							class="flex-1"
							onclick={() => (settlementPrice = '0.0')}
							size="sm"
							variant={settlementPrice === '0.0' ? 'primary' : 'outline'}
						>
							{t({ locale: $localeStore, key: 'market.resolution.settle_no' })}
						</Button>
					</div>
					<div class="space-y-2">
						<label
							class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase"
							for="settlement-price"
						>
							{t({
								locale: $localeStore,
								key: 'market.resolution.custom_price',
								params: { symbol: market.token.symbol }
							})}
						</label>
						<div class="relative">
							<input
								id="settlement-price"
								class="focus:ring-primary bg-foreground/5 text-foreground ring-border w-full rounded-2xl border-none px-4 py-3 text-lg font-bold ring-1 ring-inset focus:ring-2"
								placeholder="0.00"
								type="number"
								bind:value={settlementPrice}
							/>
						</div>
					</div>
				</div>
			{/if}

			{#if error}
				<div class="text-destructive text-xs font-medium">
					{error}
				</div>
			{/if}

			<Button
				onclick={handleSettle}
				size="lg"
				status={loading
					? 'pending'
					: (isCategorical && selectedOutcomeId) || (!isCategorical && settlementPrice !== '')
						? 'enabled'
						: 'disabled'}
				variant={isUrgent ? 'danger' : 'primary'}
			>
				{t({ locale: $localeStore, key: 'market.resolution.resolve_settle' })}
			</Button>
		</div>
	</div>
</Card>
