<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { ArrowRight, Search, Zap } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Card from '$lib/components/ui/Card.svelte';
	import InfiniteScroll from '$lib/components/ui/InfiniteScroll.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import Tabs from '$lib/components/ui/Tabs.svelte';
	import CollateralModal from '$lib/components/wallet/CollateralModal.svelte';
	import CollateralStats from '$lib/components/wallet/CollateralStats.svelte';
	import WalletHistory from '$lib/components/wallet/WalletHistory.svelte';
	import WalletReceive from '$lib/components/wallet/WalletReceive.svelte';
	import WalletSend from '$lib/components/wallet/WalletSend.svelte';
	import WalletStats from '$lib/components/wallet/WalletStats.svelte';
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
	import { collateralsStore } from '$lib/stores/collaterals.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { MarketId } from '$lib/types/market';
	import type { Token } from '$lib/types/token';
	import type { Transaction } from '$lib/types/wallet';
	import { emit } from '$lib/utils/events.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { parseToken } from '$lib/utils/parse.utils';
	import { mapClearingEventToTransaction } from '$lib/utils/transactions.utils';

	let transactions = $state<Transaction[]>([]);
	let batchSize = $state<bigint>(20n);
	const batchSizeOptions: bigint[] = [10n, 20n, 50n];
	let loadingHistory = $state(false);
	let hasMoreHistory = $state(true);

	let cursors = $state<WalletTransactionsCursors>({});
	let done = $state<WalletTransactionsDone>({ icp: false, ckUsdc: false, vxp: false });

	let activeTab = $state('send');

	let isCollateralModalOpen = $state(false);

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

	const sortNewestFirst = (arr: Transaction[]) =>
		arr.sort((a, b) => (a.timestamp === b.timestamp ? 0 : a.timestamp > b.timestamp ? -1 : 1));

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
</script>

<div class="space-y-6">
	<SectionHeader
		description={t({ locale: $localeStore, key: 'wallet.sub' })}
		highlight={t({ locale: $localeStore, key: 'wallet.eyebrow' })}
		title={t({ locale: $localeStore, key: 'wallet.title' })}
	/>

	<div class="grid w-full gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
		<div class="min-w-0">
			<WalletStats
				balances={{
					balances: $balancesStore ?? {},
					collateral: $collateralsStore?.balances ?? {}
				}}
			/>
		</div>

		<div class="min-w-0">
			<CollateralStats
				collateral={$collateralsStore}
				onManage={() => (isCollateralModalOpen = true)}
			/>
		</div>
	</div>

	<CollateralModal isOpen={isCollateralModalOpen} onClose={() => (isCollateralModalOpen = false)} />

	<!-- Dual CTA strip — V1.2 wallets nudge the user to spend VXP rather
	     than letting it sit. Primary opens Flow; ghost routes to the
	     markets list so users with an active call in mind can find one
	     directly. Stacks on mobile, side-by-side from small breakpoint up. -->
	<div class="flex flex-col gap-2 sm:flex-row">
		<button
			class="bg-primary text-primary-foreground duration-state ease-vici inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors hover:opacity-90"
			onclick={() => goto(resolve(AppPath.Flow))}
			type="button"
		>
			<Zap aria-hidden="true" size={16} strokeWidth={2.2} />
			{t({ locale: $localeStore, key: 'wallet.cta.open_flow' })}
			<ArrowRight aria-hidden="true" size={14} strokeWidth={2.2} />
		</button>
		<button
			class="border-border bg-card text-foreground hover:border-border-strong hover:bg-card duration-state ease-vici inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors"
			onclick={() => goto(resolve(AppPath.Home))}
			type="button"
		>
			<Search aria-hidden="true" size={16} strokeWidth={2.2} />
			{t({ locale: $localeStore, key: 'wallet.cta.browse_markets' })}
		</button>
	</div>

	<Card class="bg-card/85 overflow-hidden" padding="none">
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
