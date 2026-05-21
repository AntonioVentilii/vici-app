<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { get } from 'svelte/store';
	import Badge from '$lib/components/ui/Badge.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { defaultClearingCollateralToken, supportedTokens } from '$lib/derived/tokens.derived';
	import { isDev } from '$lib/env/app.env';
	import { depositCollateral, withdrawCollateral } from '$lib/services/collateral.services';
	import { collateralsStore } from '$lib/stores/collaterals.store';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Token } from '$lib/types/token';
	import { icrcLedgerDecimalsFromCollateralConfig } from '$lib/utils/asset-ref.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { parseToken } from '$lib/utils/parse.utils';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	const { isOpen, onClose }: Props = $props();

	let amount = $state('');

	let mode = $state<'Deposit' | 'Withdraw'>('Deposit');

	let selectedToken = $state<Token | undefined>();

	$effect(() => {
		if (nonNullish($defaultClearingCollateralToken) && isNullish(selectedToken)) {
			selectedToken = $defaultClearingCollateralToken;
		}
	});

	let loading = $state(false);

	let error = $state('');

	const reset = () => {
		amount = '';
		mode = 'Deposit';
		selectedToken = $defaultClearingCollateralToken;
		loading = false;
		error = '';
	};

	const close = () => {
		reset();
		onClose();
	};

	const handleSubmit = async () => {
		if (isNullish(amount) || parseFloat(amount) <= 0) {
			error = t({ locale: $localeStore, key: 'prediction.error.invalid_amount' });

			return;
		}

		loading = true;
		error = '';

		try {
			if (isNullish(selectedToken)) {
				throw new Error(t({ locale: $localeStore, key: 'wallet.collateral.no_token_selected' }));
			}

			const ledgerDecimals = icrcLedgerDecimalsFromCollateralConfig({
				assetsConfig: get(collateralsStore)?.assetsConfig ?? {},
				ledgerCanisterId: selectedToken.ledgerCanisterId,
				fallbackDecimals: selectedToken.decimals
			});

			const amt = parseToken({ value: `${amount}`, unitName: ledgerDecimals });

			if (mode === 'Deposit') {
				await depositCollateral({
					assetPrincipal: selectedToken.ledgerCanisterId,
					amount: amt,
					domain: $balanceDomain
				});
			} else {
				await withdrawCollateral({
					assetPrincipal: selectedToken.ledgerCanisterId,
					amount: amt,
					domain: $balanceDomain
				});
			}

			close();
		} catch (e: unknown) {
			error =
				(e as Error).message ??
				t({ locale: $localeStore, key: 'wallet.collateral.operation_failed' });
		} finally {
			loading = false;
		}
	};

	const modalTitle = $derived(
		mode === 'Deposit'
			? t({ locale: $localeStore, key: 'wallet.collateral.deposit_title' })
			: t({ locale: $localeStore, key: 'wallet.collateral.withdraw_title' })
	);

	const confirmLabel = $derived(
		mode === 'Deposit'
			? t({ locale: $localeStore, key: 'wallet.collateral.confirm_deposit' })
			: t({ locale: $localeStore, key: 'wallet.collateral.confirm_withdraw' })
	);
</script>

<Modal {isOpen} {onClose}>
	<BaseButton
		class="text-muted-foreground hover:text-foreground absolute top-6 right-6"
		aria-label={t({ locale: $localeStore, key: 'wallet.collateral.close_modal' })}
		onclick={close}
	>
		<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				d="M6 18L18 6M6 6l12 12"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
			/>
		</svg>
	</BaseButton>

	<h3 class="text-foreground text-2xl font-black uppercase">{modalTitle}</h3>
	<p class="text-muted-foreground mt-2 text-sm">
		{t({ locale: $localeStore, key: 'wallet.collateral.modal_subtitle' })}
	</p>

	<div class="bg-foreground/5 mt-8 flex rounded-2xl p-1">
		<BaseButton
			class="flex-1 rounded-xl py-2 text-sm font-bold {mode === 'Deposit'
				? 'bg-card text-foreground shadow-sm'
				: 'text-muted-foreground hover:text-foreground'}"
			onclick={() => (mode = 'Deposit')}
		>
			{t({ locale: $localeStore, key: 'wallet.collateral.deposit' })}
		</BaseButton>

		<BaseButton
			class="flex-1 rounded-xl py-2 text-sm font-bold {mode === 'Withdraw'
				? 'bg-card text-foreground shadow-sm'
				: 'text-muted-foreground hover:text-foreground'}"
			onclick={() => (mode = 'Withdraw')}
		>
			{t({ locale: $localeStore, key: 'wallet.collateral.withdraw' })}
		</BaseButton>
	</div>

	<div class="mt-8 space-y-6">
		<div class="space-y-2">
			<span class="text-muted-foreground text-xs font-bold tracking-widest uppercase">
				{t({ locale: $localeStore, key: 'wallet.collateral.token' })}
			</span>
			{#if $supportedTokens.length === 0}
				<p class="bg-foreground/5 text-muted-foreground rounded-xl p-4 text-sm">
					{t({ locale: $localeStore, key: 'wallet.collateral.no_assets' })}
				</p>
			{:else}
				<div class="grid grid-cols-2 gap-3">
					{#each $supportedTokens as token (token.ledgerCanisterId)}
						<BaseButton
							class="flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 font-bold {selectedToken?.ledgerCanisterId ===
							token.ledgerCanisterId
								? 'border-primary bg-primary/10 text-primary'
								: 'border-border bg-foreground/5 text-muted-foreground hover:border-foreground/10'}"
							onclick={() => (selectedToken = token)}
						>
							{token.symbol}
							{#if isDev() && token.isDevEnabled}
								<Badge size="sm" variant="warning">
									{t({ locale: $localeStore, key: 'wallet.badge.dev' })}
								</Badge>
							{/if}
						</BaseButton>
					{/each}
				</div>
			{/if}
		</div>

		<div class="space-y-2">
			<label class="text-muted-foreground text-xs font-bold tracking-widest uppercase" for="amount">
				{t({
					locale: $localeStore,
					key: 'wallet.collateral.amount_with_symbol',
					params: { symbol: selectedToken?.symbol ?? '' }
				})}
			</label>
			<div class="relative">
				<input
					id="amount"
					class="bg-foreground/5 text-foreground ring-border focus:bg-card focus:ring-primary w-full rounded-2xl border-none px-6 py-4 text-xl font-bold ring-1 ring-inset focus:ring-2"
					placeholder="0.00"
					type="number"
					bind:value={amount}
				/>
				<span class="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2 font-bold">
					{selectedToken?.symbol ?? ''}
				</span>
			</div>
		</div>

		{#if error}
			<div
				class="border-destructive/20 bg-destructive/10 text-destructive rounded-xl border p-4 text-sm"
			>
				{error}
			</div>
		{/if}

		<Button
			class="w-full py-4 text-lg font-black"
			onclick={handleSubmit}
			status={loading
				? 'pending'
				: $supportedTokens.length > 0 && nonNullish(selectedToken) && parseFloat(amount) > 0
					? 'enabled'
					: 'disabled'}
		>
			{#snippet busyLabel()}
				{t({ locale: $localeStore, key: 'wallet.collateral.processing' })}
			{/snippet}
			{confirmLabel}
		</Button>
	</div>
</Modal>
