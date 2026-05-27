<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { History } from 'lucide-svelte/icons';
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import InfiniteScroll from '$lib/components/ui/InfiniteScroll.svelte';
	import Tabs from '$lib/components/ui/Tabs.svelte';
	import WalletHistory from '$lib/components/wallet/WalletHistory.svelte';
	import WalletReceive from '$lib/components/wallet/WalletReceive.svelte';
	import WalletSend from '$lib/components/wallet/WalletSend.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { markets } from '$lib/derived/markets.derived';
	import { defaultSupportedToken, walletUiTokens } from '$lib/derived/tokens.derived';
	import { tradeHistory } from '$lib/derived/trade-history.derived';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import { sendIc } from '$lib/services/send.services';
	import {
		getTransactionsPage,
		type WalletTransactionsCursors,
		type WalletTransactionsDone
	} from '$lib/services/wallet.service';
	import { balancesStore } from '$lib/stores/balances.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { MarketId } from '$lib/types/market';
	import type { Token } from '$lib/types/token';
	import type { Transaction } from '$lib/types/wallet';
	import { emit } from '$lib/utils/events.utils';
	import { formatNanosecondsToDate, formatToken } from '$lib/utils/format.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { goBack } from '$lib/utils/nav.utils';
	import { parseToken } from '$lib/utils/parse.utils';
	import { formatVxpBalance } from '$lib/utils/playground-display.utils';
	import { mapClearingEventToTransaction } from '$lib/utils/transactions.utils';

	/**
	 * Wallet — centered hero + recent activity, matching `WalletScreen`
	 * in `screens.jsx:1303`.
	 *
	 * Layout
	 * - `MobileAppBar` with back → /profile, title "Wallet", and a
	 *   History icon on the right that focuses the activity list.
	 * - Hero card (centered): VXP eyebrow → 48px VXP balance → weekly
	 *   delta line in laurel / no-red → Open Flow + Back-a-call pill
	 *   row. Balance is read from `balancesStore` for the VXP ledger;
	 *   weekly delta sums signed deltas from clearing settlements in
	 *   the last 7 days.
	 * - Recent activity (6 rows) — derived from the same merged
	 *   `filteredTransactions` source as the History tab, surfacing
	 *   real history.
	 * - Send / Receive / History tabs remain below for actual wallet
	 *   operations. Visually toned-down to read as a secondary
	 *   surface.
	 *
	 * The `CollateralStats` secondary card + its modal are intentionally
	 * gone — collateral lives inside the History "Clearing" tagged rows
	 * and the dedicated portfolio surface; it doesn't belong on the
	 * Wallet hero.
	 */

	let transactions = $state<Transaction[]>([]);
	let batchSize = $state<bigint>(20n);
	const batchSizeOptions: bigint[] = [10n, 20n, 50n];
	let loadingHistory = $state(false);
	let hasMoreHistory = $state(true);

	let cursors = $state<WalletTransactionsCursors>({});
	let done = $state<WalletTransactionsDone>({ icp: false, ckUsdc: false, vxp: false });

	let activeTab = $state('send');

	let activityListEl: HTMLElement | undefined = $state();

	const tabs = $derived([
		{ value: 'history', label: t({ locale: $localeStore, key: 'wallet.tab.history' }) },
		{ value: 'send', label: t({ locale: $localeStore, key: 'wallet.tab.send' }) },
		{ value: 'receive', label: t({ locale: $localeStore, key: 'wallet.tab.receive' }) }
	]);

	// Map clearing trade-history events into the same `Transaction` shape as
	// ICRC ledger rows. The store is populated by `LoaderTradeHistory` and is
	// scoped to the active balance domain; we only need to pair each event
	// with its market to resolve the (VXP-denominated) settlement token.
	const clearingTransactions = $derived.by<Transaction[]>(() => {
		if ($tradeHistory.length === 0) {
			return [];
		}

		const marketById = new Map($markets.map((m) => [m.id, m] as const));

		return $tradeHistory.map((event) => {
			const market = marketById.get(event.series_id as MarketId);
			const token = market?.token ?? VXP_TOKEN;

			return mapClearingEventToTransaction({
				event,
				token,
				user: event.user.toText()
			});
		});
	});

	const filteredTransactions = $derived.by(() => {
		const allowed = new Set($walletUiTokens.map((t) => t.ledgerCanisterId));

		const merged = [...transactions, ...clearingTransactions].filter((tx) =>
			allowed.has(tx.token.ledgerCanisterId)
		);

		return sortNewestFirst(merged);
	});

	// First 6 rows powering the "Recent activity" block.
	const recentActivity = $derived(filteredTransactions.slice(0, 6));

	const sortNewestFirst = (arr: Transaction[]) =>
		arr.sort((a, b) => (a.timestamp === b.timestamp ? 0 : a.timestamp > b.timestamp ? -1 : 1));

	// Live VXP balance from the wallet store. Same source `WalletStats`
	// and `WalletDropdown` read — keyed by `TokenId`.
	const vxpBalance = $derived.by((): bigint => $balancesStore?.[VXP_TOKEN.id] ?? ZERO);

	const vxpBalanceDisplay = $derived(
		formatVxpBalance({ value: vxpBalance, decimals: VXP_TOKEN.decimals })
	);

	// Weekly VXP delta — sums signed amounts on clearing settlements
	// from the last 7 days. Settlements credit a winning call; losing
	// calls realize on the `Trade` debit side (entry stake never
	// refunded). We approximate by walking the unified transaction
	// feed and summing Settlement (in) minus Trade (out) flows on
	// VXP-denominated markets.
	const weeklyVxpDelta = $derived.by((): bigint => {
		const cutoffNs = BigInt(Date.now() - 7 * 24 * 60 * 60 * 1000) * 1_000_000n;
		let delta = ZERO;

		const recentVxpTx = filteredTransactions.filter(
			(tx) => tx.timestamp >= cutoffNs && tx.token.symbol === VXP_TOKEN.symbol
		);

		for (const tx of recentVxpTx) {
			switch (tx.type) {
				case 'Settlement':
				case 'Receive':
				case 'Mint':
				case 'Reward':
					delta += tx.amount;
					break;
				case 'Trade':
				case 'Send':
				case 'Burn':
				case 'Liquidation':
					delta -= tx.amount;
					break;
				default:
					break;
			}
		}

		return delta;
	});

	const weeklyDeltaDirection = $derived.by((): 'positive' | 'negative' | 'flat' => {
		if (weeklyVxpDelta > ZERO) {
			return 'positive';
		}

		if (weeklyVxpDelta < ZERO) {
			return 'negative';
		}

		return 'flat';
	});

	const weeklyDeltaDisplay = $derived.by((): string => {
		if (weeklyDeltaDirection === 'flat') {
			return '';
		}

		const positive = weeklyDeltaDirection === 'positive';
		const abs = positive ? weeklyVxpDelta : -weeklyVxpDelta;
		const sign = positive ? '+' : '−';

		return `${sign}${formatVxpBalance({ value: abs, decimals: VXP_TOKEN.decimals })}`;
	});

	const resetHistory = () => {
		transactions = [];
		cursors = {};
		done = { icp: false, ckUsdc: false, vxp: false };
		hasMoreHistory = true;
		loadingHistory = false;
	};

	const loadNextBatch = async () => {
		if (loadingHistory || !hasMoreHistory) {
			return;
		}

		loadingHistory = true;

		try {
			const result = await getTransactionsPage({ batchSize, cursors, done });

			const txKey = (tx: Transaction) => `${tx.id}-${tx.token.ledgerCanisterId}`;
			const merged: Record<string, Transaction> = {};

			for (const t of transactions) {
				merged[txKey(t)] = t;
			}

			for (const tx of result.transactions) {
				merged[txKey(tx)] = tx;
			}

			transactions = sortNewestFirst(Object.values(merged));

			const { cursors: nextCursors, done: nextDone, hasMore: nextHasMore } = result;
			cursors = nextCursors;
			done = nextDone;
			hasMoreHistory = nextHasMore;
		} finally {
			loadingHistory = false;
		}
	};

	const reloadHistory = async () => {
		resetHistory();
		await loadNextBatch();
	};

	onMount(() => {
		void reloadHistory();
	});

	let recipient = $state('');
	let amount = $state('');
	let selectedToken = $state<Token | undefined>();
	let sending = $state(false);

	const selectedTokenForSend = $derived(selectedToken ?? $defaultSupportedToken);

	const handleSend = async () => {
		if (sending) {
			return;
		}

		if (isNullish(recipient) || isNullish(amount) || isNullish(selectedTokenForSend)) {
			return;
		}

		sending = true;

		try {
			const identity = await safeGetIdentityOnce();

			await sendIc({
				identity,
				to: recipient,
				amount: parseToken({
					value: `${amount}`,
					unitName: selectedTokenForSend.decimals
				}),
				ledgerCanisterId: selectedTokenForSend.ledgerCanisterId
			});

			emit({ message: 'viciRefreshBalances' });

			await reloadHistory();

			amount = '';

			recipient = '';

			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'wallet.send.success_title' }),
				message: t({ locale: $localeStore, key: 'wallet.send.success_message' }),
				type: 'success'
			});
		} catch (e: unknown) {
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'wallet.send.error_title' }),
				message: (e as Error).message,
				type: 'error'
			});
		} finally {
			sending = false;
		}
	};

	const handleHistoryShortcut = () => {
		activeTab = 'history';
		// Defer to next tick so the History panel is mounted before scrolling.
		queueMicrotask(() => {
			activityListEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
	};

	// Row helpers — title / direction / amount label for the recent
	// activity list. Mirrors `WalletHistory`'s `directionFor` but renders
	// a single inline string (e.g. "Won · {market}", "Stake · {market}",
	// "Receive", "Send") so the row reads at a glance.
	const marketTitle = (marketId: string | undefined): string | undefined =>
		marketId ? $markets.find((m) => m.id === marketId)?.title : undefined;

	const recentRowTitleKey = (tx: Transaction): MessageKey => {
		switch (tx.type) {
			case 'Settlement':
				return 'wallet.row.settlement';
			case 'Trade':
				return 'wallet.row.trade';
			case 'CollateralDeposit':
				return 'wallet.row.collateral_deposit';
			case 'CollateralWithdraw':
				return 'wallet.row.collateral_withdraw';
			case 'OrderPlaced':
				return 'wallet.row.order_placed';
			case 'OrderCancelled':
				return 'wallet.row.order_cancelled';
			case 'Liquidation':
				return 'wallet.row.liquidation';
			case 'Reward':
				return 'wallet.row.reward';
			case 'Send':
				return 'wallet.row.send';
			case 'Receive':
				return 'wallet.row.receive';
			case 'Mint':
				return 'wallet.row.mint';
			case 'Burn':
				return 'wallet.row.burn';
			case 'Approve':
				return 'wallet.row.approve';
			default:
				return 'wallet.row.activity';
		}
	};

	const recentRowDirection = (tx: Transaction): 'in' | 'out' | 'neutral' => {
		switch (tx.type) {
			case 'Receive':
			case 'Mint':
			case 'CollateralWithdraw':
			case 'Settlement':
			case 'Reward':
				return 'in';
			case 'Send':
			case 'Burn':
			case 'CollateralDeposit':
			case 'Trade':
			case 'Liquidation':
				return 'out';
			default:
				return 'neutral';
		}
	};

	const recentRowAmount = (tx: Transaction): string => {
		const direction = recentRowDirection(tx);
		const formatted =
			tx.token.symbol === VXP_TOKEN.symbol
				? formatVxpBalance({ value: tx.amount, decimals: tx.token.decimals })
				: formatToken({ value: tx.amount, unitName: tx.token.decimals });

		if (direction === 'in') {
			return `+${formatted}`;
		}

		if (direction === 'out') {
			return `−${formatted}`;
		}

		return formatted;
	};
</script>

{#snippet appbarRight()}
	<button
		class="appbar-icon-btn"
		aria-label={t({ locale: $localeStore, key: 'wallet.history.icon_label' })}
		onclick={handleHistoryShortcut}
		type="button"
	>
		<History aria-hidden="true" size={18} strokeWidth={1.8} />
	</button>
{/snippet}

<div class="wallet-page">
	<MobileAppBar
		align="center"
		back={{
			label: t({ locale: $localeStore, key: 'wallet.back.label' }),
			onBack: () => goBack(resolve(AppPath.Profile))
		}}
		right={appbarRight as Snippet}
		title={t({ locale: $localeStore, key: 'wallet.title' })}
	/>

	<!-- Centered hero: VXP eyebrow + 48px num + weekly delta + dual CTA. -->
	<section class="wallet-hero">
		<p class="eyebrow wallet-hero-eyebrow">
			{t({ locale: $localeStore, key: 'wallet.hero.eyebrow' })}
		</p>
		<p class="num wallet-hero-num">{vxpBalanceDisplay}</p>

		{#if weeklyDeltaDirection === 'flat'}
			<p class="num wallet-hero-delta is-flat">
				{t({ locale: $localeStore, key: 'wallet.hero.no_activity_week' })}
			</p>
		{:else}
			<p
				class="num wallet-hero-delta"
				class:is-negative={weeklyDeltaDirection === 'negative'}
				class:is-positive={weeklyDeltaDirection === 'positive'}
			>
				{t({
					locale: $localeStore,
					key: 'wallet.hero.delta_this_week',
					params: { amount: weeklyDeltaDisplay }
				})}
			</p>
		{/if}

		<div class="wallet-hero-cta-row">
			<button
				class="wallet-hero-cta is-primary"
				onclick={() => void goto(resolve(AppPath.Flow))}
				type="button"
			>
				{t({ locale: $localeStore, key: 'wallet.cta.open_flow' })}
			</button>
			<button
				class="wallet-hero-cta is-ghost"
				onclick={() => void goto(resolve(AppPath.Home))}
				type="button"
			>
				{t({ locale: $localeStore, key: 'wallet.cta.back_a_call' })}
			</button>
		</div>
	</section>

	<!-- Recent activity — top 6 from the unified transactions feed. -->
	<section bind:this={activityListEl} class="wallet-activity">
		<h2 class="wallet-activity-title">
			{t({ locale: $localeStore, key: 'wallet.recent_activity' })}
		</h2>

		{#if recentActivity.length === 0}
			<p class="wallet-activity-empty serif-italic">
				{t({ locale: $localeStore, key: 'wallet.recent_activity.empty' })}
			</p>
		{:else}
			<ul class="wallet-activity-list">
				{#each recentActivity as tx (`${tx.id}-${tx.token.ledgerCanisterId}`)}
					{@const direction = recentRowDirection(tx)}
					{@const subtitle = marketTitle(tx.marketId)}

					<li class="wallet-activity-row">
						<div class="wallet-activity-row-body">
							<span class="wallet-activity-row-title">
								{t({ locale: $localeStore, key: recentRowTitleKey(tx) })}
								{#if subtitle}
									<span class="wallet-activity-row-sep">·</span>
									<span class="wallet-activity-row-sub">{subtitle}</span>
								{/if}
							</span>
							<span class="num wallet-activity-row-when">
								{formatNanosecondsToDate({ nanoseconds: tx.timestamp })}
							</span>
						</div>
						<span
							class="num wallet-activity-row-amount"
							class:is-negative={direction === 'out'}
							class:is-positive={direction === 'in'}
						>
							{recentRowAmount(tx)}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!--
		Send / Receive / History tabs. Visually toned-down — no big
		"TREASURY" eyebrow and no `CollateralStats` secondary card.
	-->
	<Card class="wallet-tabs-card bg-card/85 overflow-hidden" padding="none">
		<div class="border-border border-b p-2">
			<Tabs {tabs} bind:activeTab />
		</div>

		<div class="w-full p-4 sm:p-6">
			{#if activeTab === 'send'}
				{#if nonNullish(selectedTokenForSend)}
					<WalletSend
						{amount}
						onAmountChange={(v) => (amount = v)}
						onRecipientChange={(v) => (recipient = v)}
						onSend={handleSend}
						onTokenChange={(v) => (selectedToken = v)}
						{recipient}
						selectedToken={selectedTokenForSend}
						sendStatus={sending ? 'pending' : 'enabled'}
					/>
				{:else}
					<p class="text-muted-foreground text-sm">
						{t({ locale: $localeStore, key: 'wallet.send.empty' })}
					</p>
				{/if}
			{:else if activeTab === 'receive'}
				<WalletReceive />
			{:else if activeTab === 'history'}
				<div class="space-y-4">
					<div class="flex items-center justify-between gap-4">
						<div class="eyebrow">
							{t({ locale: $localeStore, key: 'wallet.history.batch_size' })}
						</div>
						<div class="flex items-center gap-2">
							<select
								class="border-border bg-foreground/5 text-foreground focus:border-primary rounded-full border px-3 py-1.5 text-sm"
								aria-label={t({ locale: $localeStore, key: 'wallet.history.batch_size_label' })}
								disabled={loadingHistory}
								onchange={(e) => {
									batchSize = BigInt((e.target as HTMLSelectElement).value);
									void reloadHistory();
								}}
							>
								{#each batchSizeOptions as option (option.toString())}
									<option selected={option === batchSize} value={option.toString()}>
										{option.toString()}
									</option>
								{/each}
							</select>
						</div>
					</div>

					<WalletHistory transactions={filteredTransactions} />

					<div class="flex flex-col items-center gap-3 pt-6 pb-2">
						{#if !loadingHistory && !hasMoreHistory && transactions.length > 0}
							<div class="text-muted-foreground text-xs">
								{t({ locale: $localeStore, key: 'wallet.history.all_caught_up' })}
							</div>
						{/if}

						<InfiniteScroll
							hasMore={hasMoreHistory}
							loading={loadingHistory}
							onLoadMore={() => {
								void loadNextBatch();
							}}
						/>
					</div>
				</div>
			{/if}
		</div>
	</Card>
</div>

<style lang="postcss">
	.wallet-page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 0 1.25rem 6rem;
	}

	/* ── Hero card ───────────────────────────────────────────── */
	.wallet-hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1.5rem 1.25rem 1.75rem;
		text-align: center;
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-16, 16px);
	}

	.wallet-hero-eyebrow {
		margin: 0;
		color: var(--text-muted);
	}

	.wallet-hero-num {
		margin: 0.25rem 0 0;
		font-size: 48px;
		font-weight: 600;
		letter-spacing: -0.04em;
		color: var(--text-base);
		line-height: 1;
	}

	.wallet-hero-delta {
		margin: 0.25rem 0 0;
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-muted);
	}

	.wallet-hero-delta.is-positive {
		color: var(--yes);
	}

	.wallet-hero-delta.is-negative {
		color: var(--no);
	}

	.wallet-hero-delta.is-flat {
		color: var(--text-muted);
	}

	.wallet-hero-cta-row {
		display: flex;
		gap: 0.5rem;
		width: 100%;
		margin-top: 1rem;
	}

	.wallet-hero-cta {
		flex: 1;
		appearance: none;
		padding: 0.75rem 1rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 600;
		border-radius: var(--r-12);
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici),
			opacity var(--d-hover) var(--ease-vici);
	}

	.wallet-hero-cta.is-primary {
		color: var(--bg-base);
		background: var(--text-base);
		border: 1px solid var(--text-base);
	}

	.wallet-hero-cta.is-primary:hover {
		opacity: 0.9;
	}

	.wallet-hero-cta.is-ghost {
		color: var(--text-base);
		background: var(--bg-popover);
		border: 1px solid var(--border-base);
	}

	.wallet-hero-cta.is-ghost:hover {
		border-color: var(--border-strong);
	}

	/* ── Recent activity ─────────────────────────────────────── */
	.wallet-activity {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.wallet-activity-title {
		margin: 0 0 0.25rem;
		font-size: var(--t-16, 1rem);
		font-weight: 700;
		color: var(--text-base);
		letter-spacing: var(--tracking-tight);
	}

	.wallet-activity-empty {
		margin: 0;
		padding: 1.25rem 0.5rem;
		font-size: var(--t-14);
		color: var(--text-muted);
	}

	.wallet-activity-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.wallet-activity-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 0.875rem;
		background: var(--bg-popover);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.wallet-activity-row-body {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.wallet-activity-row-title {
		font-size: var(--t-13);
		font-weight: 500;
		color: var(--text-base);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.wallet-activity-row-sep {
		margin: 0 0.25rem;
		color: var(--text-muted);
	}

	.wallet-activity-row-sub {
		color: var(--text-muted);
	}

	.wallet-activity-row-when {
		font-size: var(--text-eyebrow, 11px);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.wallet-activity-row-amount {
		flex: 0 0 auto;
		font-size: var(--t-14);
		font-weight: 600;
		color: var(--text-muted);
	}

	.wallet-activity-row-amount.is-positive {
		color: var(--yes);
	}

	.wallet-activity-row-amount.is-negative {
		color: var(--no);
	}

	/* ── Tabs card ──────────────────────────────────────────── */
	:global(.wallet-tabs-card) {
		margin-top: 0.25rem;
	}
</style>
