<script lang="ts">
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
	import { SUPPORTED_TOKENS } from '$lib/constants/tokens/tokens.ic.constants';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import { sendIc } from '$lib/services/send.services';
	import { getTransactions } from '$lib/services/wallet.service';
	import { balancesStore } from '$lib/stores/balances.store';
	import { collateralsStore } from '$lib/stores/collaterals.store';
	import type { Token } from '$lib/types/token';
	import type { Transaction } from '$lib/types/wallet';
	import { emit } from '$lib/utils/events.utils';
	import { parseToken } from '$lib/utils/parse.utils';

	let transactions = $state<Transaction[]>([]);

	let activeTab = $state('Send');

	let isCollateralModalOpen = $state(false);

	const tabs = ['Send', 'Receive', 'History'];

	onMount(async () => {
		transactions = await getTransactions();
	});

	let recipient = $state('');

	let amount = $state('');

	let selectedToken = $state<Token>(SUPPORTED_TOKENS[0]);

	const handleSend = async () => {
		if (!recipient || !amount) {
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

			alert('Transaction successful!');
		} catch (e: unknown) {
			alert((e as Error).message);
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

	<!-- Operations Tabs -->
	<Card padding="none">
		<Tabs {tabs} bind:activeTab />

		<div class="w-full p-8">
			{#if activeTab === 'Send'}
				<WalletSend
					{amount}
					onAmountChange={(v) => (amount = v)}
					onRecipientChange={(v) => (recipient = v)}
					onSend={handleSend}
					onTokenChange={(v) => (selectedToken = v)}
					{recipient}
					{selectedToken}
				/>
			{:else if activeTab === 'Receive'}
				<WalletReceive />
			{:else}
				<WalletHistory {transactions} />
			{/if}
		</div>
	</Card>
</div>
