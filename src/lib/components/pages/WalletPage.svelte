<script lang="ts">
	import { onMount } from 'svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
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
	import { emitRefreshBalance } from '$lib/utils/refresh.utils';

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
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="lg:col-span-1">
			<WalletStats balances={{ balances: $balancesStore, collateral: $collateralsStore }} />
		</div>
		<div class="lg:col-span-2">
			<CollateralStats
				collateral={$collateralsStore}
				onManage={() => (isCollateralModalOpen = true)}
			/>
		</div>
	</div>

	<CollateralModal
		isOpen={isCollateralModalOpen}
		onClose={() => (isCollateralModalOpen = false)}
		onSuccess={emitRefreshBalance}
	/>

	<!-- Operations Tabs -->
	<div class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
		<div class="flex border-b border-slate-100">
			{#each tabs as tab (tab)}
				<button
					class="flex-1 py-4 text-sm font-bold transition-all {activeTab === tab
						? 'border-b-2 border-indigo-600 bg-slate-50 text-indigo-600'
						: 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'}"
					onclick={() => (activeTab = tab)}
				>
					{tab}
				</button>
			{/each}
		</div>

		<div class="p-8">
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
	</div>
</div>
