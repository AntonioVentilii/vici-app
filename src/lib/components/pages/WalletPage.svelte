<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onMount } from 'svelte';
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
	import { defaultSupportedToken, walletUiTokens } from '$lib/derived/tokens.derived';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import { sendIc } from '$lib/services/send.services';
	import {
		getTransactionsPage,
		type WalletTransactionsCursors,
		type WalletTransactionsDone
	} from '$lib/services/wallet.service';
	import { balancesStore } from '$lib/stores/balances.store';
	import { collateralsStore } from '$lib/stores/collaterals.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { Token } from '$lib/types/token';
	import type { Transaction } from '$lib/types/wallet';
	import { emit } from '$lib/utils/events.utils';
	import { parseToken } from '$lib/utils/parse.utils';

	let transactions = $state<Transaction[]>([]);
	let batchSize = $state<bigint>(20n);
	const batchSizeOptions: bigint[] = [10n, 20n, 50n];
	let loadingHistory = $state(false);
	let hasMoreHistory = $state(true);

	let cursors = $state<WalletTransactionsCursors>({});
	let done = $state<WalletTransactionsDone>({ icp: false, ckUsdc: false, vxp: false });

	let activeTab = $state('Send');

	let isCollateralModalOpen = $state(false);

	const tabs = ['History', 'Send', 'Receive'];

	const filteredTransactions = $derived.by(() => {
		const allowed = new Set($walletUiTokens.map((t) => t.ledgerCanisterId));

		return transactions.filter((tx) => allowed.has(tx.token.ledgerCanisterId));
	});

	$effect(() => {
		if (!tabs.includes(activeTab)) {
			[activeTab] = tabs;
		}
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

	$effect(() => {
		if (nonNullish($defaultSupportedToken) && isNullish(selectedToken)) {
			selectedToken = $defaultSupportedToken;
		}
	});

	const handleSend = async () => {
		if (isNullish(recipient) || isNullish(amount) || isNullish(selectedToken)) {
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
					unitName: selectedToken.decimals
				}),
				ledgerCanisterId: selectedToken.ledgerCanisterId
			});

			emit({ message: 'viciRefreshBalances' });

			await reloadHistory();

			amount = '';

			recipient = '';

			notificationsStore.add({
				title: 'Success',
				message: 'Transaction successful!',
				type: 'success'
			});
		} catch (e: unknown) {
			notificationsStore.add({
				title: 'Error',
				message: (e as Error).message,
				type: 'error'
			});
		} finally {
			sending = false;
		}
	};
</script>

<div class="space-y-8">
	<SectionHeader
		description="Manage your assets securely on the Internet Computer."
		highlight="Wallet"
		title="Your"
	/>

	<!-- Balances Cards -->
	<div class="flex w-full flex-col gap-6 lg:flex-row">
		<div class="grow">
			<WalletStats
				balances={{
					balances: $balancesStore ?? {},
					collateral: $collateralsStore?.balances ?? {}
				}}
			/>
		</div>

		<div class="grow-2">
			<CollateralStats
				collateral={$collateralsStore}
				onManage={() => (isCollateralModalOpen = true)}
			/>
		</div>
	</div>

	<CollateralModal isOpen={isCollateralModalOpen} onClose={() => (isCollateralModalOpen = false)} />

	<!-- Operations -->
	<Card padding="none">
		<Tabs {tabs} bind:activeTab />

		<div class="w-full p-8">
			{#if activeTab === 'Send'}
				{#if nonNullish(selectedToken)}
					<WalletSend
						{amount}
						onAmountChange={(v) => (amount = v)}
						onRecipientChange={(v) => (recipient = v)}
						onSend={handleSend}
						onTokenChange={(v) => (selectedToken = v)}
						{recipient}
						{selectedToken}
						sendStatus={sending ? 'pending' : 'enabled'}
					/>
				{:else}
					<p class="text-muted-foreground text-sm">
						Loading send options… If this persists, no tokens are available for your current
						network.
					</p>
				{/if}
			{:else if activeTab === 'Receive'}
				<WalletReceive />
			{:else if activeTab === 'History'}
				<div class="space-y-4">
					<div class="flex items-center justify-between gap-4">
						<div class="text-foreground text-sm font-bold">Batch size</div>
						<div class="flex items-center gap-2">
							<select
								class="border-border bg-card text-foreground rounded border px-2 py-1 text-sm"
								aria-label="Transactions batch size"
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
							<div class="text-muted-foreground text-xs">All caught up.</div>
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
