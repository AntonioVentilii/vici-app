<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import { X } from '@lucide/svelte/icons';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import SignInActions from '$lib/components/authn/SignInActions.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { VXP_STAKE_LADDER } from '$lib/constants/vxp-economy.constants';
	import { playgroundVxpUnitMode } from '$lib/derived/playground.derived';
	import { walletUiTokens } from '$lib/derived/tokens.derived';
	import { userSignedIn } from '$lib/derived/user.derived';
	import { getBalances } from '$lib/services/wallet.service';
	import { collateralsStore } from '$lib/stores/collaterals.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { CallSide, Market } from '$lib/types/market';
	import { icrcLedgerDecimalsFromCollateralConfig } from '$lib/utils/asset-ref.utils';
	import { createFocusTrap, type FocusTrap } from '$lib/utils/focus-trap.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { resolveOutcomeExecutionPrice } from '$lib/utils/market.utils';
	import {
		formatAvailableMarginForUi,
		intuitiveAvailableMarginUsd,
		nativeToClearingMarginUnits
	} from '$lib/utils/playground-display.utils';
	import { executeOutcomeTrade } from '$lib/utils/trade.utils';

	/**
	 * Prediction-confirmation surface for a binary market. A user has
	 * already chosen a side (YES / NO) on the market detail CTA; this
	 * panel commits a single market-order call at the current price.
	 *
	 * Presentation is responsive: a bottom-docked sheet (grip handle,
	 * slide-up) on phone widths and a centred modal on wider viewports —
	 * one set of content, switched purely in CSS so there is no forked
	 * markup. Chrome is custom (not a native `<dialog>`), so focus is
	 * trapped manually via {@link createFocusTrap}, matching the other
	 * bottom-sheet surfaces.
	 *
	 * Sizing is a slider that steps through the fixed stake ladder
	 * (`VXP_STAKE_LADDER`) rather than a free continuous range, because
	 * `executeOutcomeTrade` rejects any premium that isn't a ladder rung
	 * on ViciXp markets — so every selectable value must be a valid rung.
	 * No limit-order / target-price path lives here — the only submission
	 * is a market order; the clearing layer still picks `MARKET` vs
	 * `LIMIT` execution from live depth under the hood.
	 */
	interface Props {
		market: Market;
		selectedOutcome: CallSide;
		onClose: () => void;
		onPredictionPlaced: () => void;
	}

	const { market, selectedOutcome, onClose, onPredictionPlaced }: Props = $props();

	const tr = ({ key, params }: { key: MessageKey; params?: Record<string, string | number> }) =>
		t({ locale: $localeStore, key, params });

	// Call-size slider — an index-based control over the fixed stake
	// ladder, so every stop is a valid rung the backend will accept (a
	// free continuous range would let the user pick amounts ViciXp markets
	// reject). Defaults to the smallest rung; `size` is the selected rung
	// amount, derived from the slider index.
	let sizeIndex = $state(0);
	const size = $derived(VXP_STAKE_LADDER[sizeIndex]);

	let sheetEl = $state<HTMLDivElement | undefined>();
	let trap: FocusTrap | null = null;

	let loading = $state(false);
	let error = $state('');

	const sideLabel = $derived(
		selectedOutcome === 'YES' ? tr({ key: 'outcome.yes' }) : tr({ key: 'outcome.no' })
	);

	// Execution price of the chosen side, shared with `executeOutcomeTrade` so
	// the previewed "+X VXP" matches the order placed.
	const sideExecutionPrice = $derived(
		resolveOutcomeExecutionPrice({ market, action: selectedOutcome })
	);

	const payout = $derived.by(() => {
		if (!Number.isFinite(sideExecutionPrice) || sideExecutionPrice <= 0) {
			return size;
		}

		return Math.round(size / sideExecutionPrice);
	});

	// Available collateral for this market's balance domain, reusing the
	// shared intuitive-margin derivation so the figure matches the wallet
	// and other prediction surfaces.
	const availableMargin = $derived.by(() => {
		if (isNullish($collateralsStore)) {
			return ZERO;
		}

		const account = $collateralsStore.accountState;

		if (isNullish(account)) {
			return ZERO;
		}

		let fallback = ZERO;

		for (const token of $walletUiTokens) {
			const balance = $collateralsStore?.balances[token.id] ?? ZERO;

			if (balance > ZERO) {
				const decimals = icrcLedgerDecimalsFromCollateralConfig({
					assetsConfig: $collateralsStore?.assetsConfig ?? {},
					ledgerCanisterId: token.ledgerCanisterId,
					fallbackDecimals: token.decimals
				});
				fallback += nativeToClearingMarginUnits({
					nativeBalance: balance,
					nativeDecimals: decimals
				});
			}
		}

		return intuitiveAvailableMarginUsd({
			assets: account.assets,
			totalEquityUsd: account.total_equity_usd,
			availableMarginUsd: account.available_margin_usd,
			fallbackCollateralMarginUnits: fallback
		});
	});

	const balanceLabel = $derived(
		formatAvailableMarginForUi({ value: availableMargin, playground: $playgroundVxpUnitMode })
	);

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

	const handleLockIn = async () => {
		if (loading) {
			return;
		}

		loading = true;
		error = '';

		try {
			await executeOutcomeTrade({
				market,
				action: selectedOutcome,
				amount: String(size),
				orderType: 'MARKET'
			});

			notificationsStore.add({
				title: tr({ key: 'prediction.notification.title' }),
				message: tr({ key: 'prediction.notification.message', params: { side: sideLabel } }),
				type: 'success'
			});

			void fetchBalance();
			onPredictionPlaced();
		} catch (err: unknown) {
			error = (err as Error).message ?? tr({ key: 'prediction.error.failed' });
		} finally {
			loading = false;
		}
	};

	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			onClose();
		}
	};

	$effect(() => {
		if (!browser) {
			return;
		}

		if ($userSignedIn) {
			void fetchBalance();
		}
	});

	$effect(() => {
		if (!browser) {
			return;
		}

		if (sheetEl) {
			trap = createFocusTrap(sheetEl);
			trap.activate();
		}

		return () => {
			if (trap) {
				trap.deactivate();
				trap = null;
			}
		};
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

<div
	class="confirm-scrim"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
	role="presentation"
>
	<div
		bind:this={sheetEl}
		class="confirm-panel"
		aria-labelledby="confirm-title"
		aria-modal="true"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
		role="dialog"
		tabindex="-1"
	>
		<div class="confirm-grip" aria-hidden="true"></div>

		<div class="confirm-head">
			<h3 id="confirm-title" class="confirm-title">
				{tr({ key: 'prediction.back_side', params: { side: sideLabel } })}
			</h3>
			<button
				class="confirm-close"
				aria-label={tr({ key: 'a11y.close' })}
				onclick={onClose}
				type="button"
			>
				<X aria-hidden="true" size={16} strokeWidth={1.8} />
			</button>
		</div>

		<p class="confirm-question">{market.title}</p>

		{#if $userSignedIn}
			<div class="confirm-card">
				<div class="confirm-card-head">
					<span class="confirm-eyebrow">{tr({ key: 'prediction.how_much' })}</span>
					<span class="confirm-balance num">
						{tr({ key: 'prediction.balance', params: { amount: balanceLabel } })}
					</span>
				</div>

				<div class="confirm-amount">
					<span class="confirm-amount-value num">{size}</span>
					<span class="confirm-eyebrow">{market.token.symbol}</span>
				</div>

				<input
					class="confirm-range"
					aria-label={tr({ key: 'prediction.how_much' })}
					max={VXP_STAKE_LADDER.length - 1}
					min={0}
					step={1}
					type="range"
					bind:value={sizeIndex}
				/>

				<div class="confirm-payout">
					<span class="confirm-payout-label">{tr({ key: 'prediction.if_right' })}</span>
					<span class="confirm-payout-value num">
						{tr({
							key: 'prediction.payout',
							params: { amount: payout, symbol: market.token.symbol }
						})}
					</span>
				</div>
			</div>

			{#if error}
				<div class="confirm-error">{error}</div>
			{/if}

			<Button
				class="confirm-submit"
				onclick={handleLockIn}
				size="lg"
				status={loading ? 'pending' : 'enabled'}
			>
				{#snippet busyLabel()}
					{tr({ key: 'prediction.confirming' })}
				{/snippet}
				{tr({ key: 'prediction.lock_in', params: { side: sideLabel } })}
			</Button>
		{:else}
			<div class="confirm-signin">
				<p class="confirm-signin-copy">{tr({ key: 'prediction.sign_in' })}</p>
				<SignInActions />
				<a class="confirm-deposit" href={resolve(AppPath.Wallet)}>
					{tr({ key: 'prediction.deposit_wallet' })}
				</a>
			</div>
		{/if}
	</div>
</div>

<style lang="postcss">
	:global(body:has(.confirm-panel)) {
		overflow: hidden;
	}

	/* Hide the floating mobile pill-nav while the sheet is open — it sits
	   at the same bottom edge and would clip the lock-in action, and it
	   isn't usable from inside a modal flow. */
	:global(body:has(.confirm-panel) .pillnav-wrap) {
		display: none;
	}

	.confirm-scrim {
		position: fixed;
		/* `100dvh` rather than a fixed `inset: 0`: on iOS the large layout
		 * viewport that `inset: 0` resolves against pushes the bottom-docked
		 * panel behind the dynamic bottom toolbar, clipping its CTA. */
		top: 0;
		left: 0;
		right: 0;
		height: 100vh; /* fallback for engines without `dvh` */
		height: 100dvh;
		z-index: 80;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		background: rgba(14, 13, 11, 0.62);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		animation: confirm-scrim-in var(--d-state) ease-out both;
	}

	.confirm-panel {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 32rem;
		max-height: 92vh; /* fallback for engines without `dvh` */
		max-height: 92dvh;
		padding: 0.5rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
		overflow-y: auto;
		background: var(--bg-popover);
		border-top: 1px solid var(--border-base);
		border-top-left-radius: 22px;
		border-top-right-radius: 22px;
		box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.4);
		animation: confirm-panel-up 280ms var(--ease-vici) both;
	}

	/* Desktop: re-anchor the same panel to the viewport centre with a
	   full rounded card and a zoom-in entrance rather than a slide-up. */
	@media (min-width: 768px) {
		.confirm-scrim {
			justify-content: center;
			padding: 1rem;
		}

		.confirm-panel {
			max-width: 28rem;
			max-height: 90vh; /* fallback for engines without `dvh` */
			max-height: 90dvh;
			padding: 1.5rem;
			border: 1px solid var(--border-base);
			border-radius: 12px;
			box-shadow: var(--shadow-modal);
			animation: confirm-panel-zoom 200ms var(--ease-vici) both;
		}

		/* The grip handle is a bottom-sheet affordance only. */
		.confirm-grip {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.confirm-scrim,
		.confirm-panel {
			animation: none;
		}
	}

	.confirm-grip {
		align-self: center;
		width: 36px;
		height: 4px;
		margin: 0.25rem 0 0.7rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-muted) 50%, transparent);
	}

	.confirm-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.confirm-title {
		margin: 0;
		font-size: var(--t-20);
		font-weight: 700;
		letter-spacing: var(--tracking-snug);
		color: var(--text-base);
	}

	.confirm-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.375rem 0.5rem;
		border: none;
		border-radius: var(--r-8);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: color var(--d-hover) var(--ease-vici);
	}

	.confirm-close:hover {
		color: var(--text-base);
	}

	.confirm-question {
		margin: 0 0 1rem;
		font-size: var(--t-14);
		color: var(--text-muted);
	}

	.confirm-card {
		padding: 1rem;
		border: 1px solid var(--border-base);
		border-radius: 12px;
		background: var(--bg-surface);
	}

	.confirm-card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.confirm-eyebrow {
		font-family: var(--font-mono);
		font-size: var(--t-10);
		font-weight: 600;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.confirm-balance {
		font-family: var(--font-mono);
		font-size: var(--t-10);
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.confirm-amount {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.confirm-amount-value {
		font-family: var(--font-mono);
		font-size: 2.25rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: var(--text-base);
	}

	.confirm-range {
		width: 100%;
		margin-top: 0.75rem;
		accent-color: var(--accent);
		cursor: pointer;
	}

	.confirm-payout {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 0.625rem;
		font-size: var(--t-13);
	}

	.confirm-payout-label {
		color: var(--text-muted);
	}

	.confirm-payout-value {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--accent);
	}

	.confirm-error {
		margin-top: 0.75rem;
		padding: 0.75rem;
		border: 1px solid color-mix(in srgb, var(--no) 22%, transparent);
		border-radius: var(--r-8);
		background: color-mix(in srgb, var(--no) 8%, transparent);
		font-size: var(--t-12);
		font-weight: 500;
		color: var(--no);
	}

	:global(.confirm-submit) {
		width: 100%;
		margin-top: 0.875rem;
	}

	.confirm-signin {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 1.5rem;
		border-radius: 12px;
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		text-align: center;
	}

	.confirm-signin-copy {
		margin: 0;
		font-size: var(--t-14);
		font-weight: 500;
		color: var(--color-primary);
	}

	.confirm-deposit {
		font-size: var(--t-12);
		font-weight: 700;
		color: var(--color-primary);
		text-decoration: underline;
	}

	.confirm-deposit:hover {
		text-decoration: none;
	}

	@keyframes confirm-scrim-in {
		from {
			opacity: 0;
		}
	}

	@keyframes confirm-panel-up {
		from {
			transform: translateY(100%);
		}
	}

	@keyframes confirm-panel-zoom {
		from {
			opacity: 0;
			transform: scale(0.96);
		}
	}
</style>
