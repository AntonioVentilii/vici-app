<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onMount } from 'svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import Tabs from '$lib/components/ui/Tabs.svelte';
	import CollateralModal from '$lib/components/wallet/CollateralModal.svelte';
	import CollateralStats from '$lib/components/wallet/CollateralStats.svelte';
	import WalletHistory from '$lib/components/wallet/WalletHistory.svelte';
	import WalletReceive from '$lib/components/wallet/WalletReceive.svelte';
	import WalletSend from '$lib/components/wallet/WalletSend.svelte';
	import WalletStats from '$lib/components/wallet/WalletStats.svelte';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { defaultSupportedToken, walletUiTokens } from '$lib/derived/tokens.derived';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import { sendIc } from '$lib/services/send.services';
	import { getTransactions } from '$lib/services/wallet.service';
	import { balancesStore } from '$lib/stores/balances.store';
	import { collateralsStore } from '$lib/stores/collaterals.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { Token } from '$lib/types/token';
	import type { Transaction } from '$lib/types/wallet';
	import { isViciXp } from '$lib/utils/balance-domain.utils';
	import { emit } from '$lib/utils/events.utils';
	import { parseToken } from '$lib/utils/parse.utils';

	let transactions = $state<Transaction[]>([]);

	let activeTab = $state('Send');

	let isCollateralModalOpen = $state(false);

	const isPlaygroundWallet = $derived(isViciXp($balanceDomain));

	const tabs = $derived(isPlaygroundWallet ? ['History'] : ['Send', 'Receive', 'History']);

	const filteredTransactions = $derived.by(() => {
		const allowed = new Set($walletUiTokens.map((t) => t.ledgerCanisterId));
		return transactions.filter((tx) => allowed.has(tx.token.ledgerCanisterId));
	});

	$effect(() => {
		if (!tabs.includes(activeTab)) {
			[activeTab] = tabs;
		}
	});

	onMount(async () => {
		transactions = await getTransactions();
	});

	let recipient = $state('');

	let amount = $state('');

	let selectedToken = $state<Token | undefined>();

	$effect(() => {
		if (nonNullish($defaultSupportedToken) && isNullish(selectedToken)) {
			selectedToken = $defaultSupportedToken;
		}
	});

	const handleSend = async () => {
		if (isNullish(recipient) || isNullish(amount) || isNullish(selectedToken)) {
			return;
		}

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

			transactions = await getTransactions();

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
				balances={{ balances: $balancesStore, collateral: $collateralsStore.balances }}
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

	<!-- Operations Tabs (Send/Receive hidden in ViciXp playground — ledger ops not used there) -->
	<Card padding="none">
		{#if !isPlaygroundWallet}
			<Tabs {tabs} bind:activeTab />
		{/if}

		<div class="w-full p-8">
			{#if isPlaygroundWallet}
				<WalletHistory transactions={filteredTransactions} />
			{:else if activeTab === 'Send'}
				{#if nonNullish(selectedToken)}
					<WalletSend
						{amount}
						onAmountChange={(v) => (amount = v)}
						onRecipientChange={(v) => (recipient = v)}
						onSend={handleSend}
						onTokenChange={(v) => (selectedToken = v)}
						{recipient}
						{selectedToken}
					/>
				{:else}
					<p class="text-sm text-slate-500">
						Loading send options… If this persists, no tokens are available for your current
						network.
					</p>
				{/if}
			{:else if activeTab === 'Receive'}
				<WalletReceive />
			{:else if activeTab === 'History'}
				<WalletHistory transactions={filteredTransactions} />
			{/if}
		</div>
	</Card>
</div>
