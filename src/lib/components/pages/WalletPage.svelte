<script lang="ts">
	import { onMount } from 'svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import CollateralModal from '$lib/components/wallet/CollateralModal.svelte';
	import CollateralStats from '$lib/components/wallet/CollateralStats.svelte';
	import WalletHistory from '$lib/components/wallet/WalletHistory.svelte';
	import WalletReceive from '$lib/components/wallet/WalletReceive.svelte';
	import WalletSend from '$lib/components/wallet/WalletSend.svelte';
	import WalletStats from '$lib/components/wallet/WalletStats.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { getBalances, getTransactions, sendCkUSDC, sendICP } from '$lib/services/wallet.service';
	import type { Transaction, WalletBalance } from '$lib/types/wallet';

	let balances = $state<WalletBalance>({ icp: ZERO, ckUsdc: ZERO, collateral: ZERO });
	let transactions = $state<Transaction[]>([]);
	let activeTab = $state('Send');
	let isCollateralModalOpen = $state(false);

	const tabs = ['Send', 'Receive', 'History'];

	onMount(async () => {
		balances = await getBalances();
		transactions = await getTransactions();
	});

	const formatBalance = (b: bigint) => (Number(b) / 100_000_000).toFixed(4);

	let recipient = $state('');
	let amount = $state('');
	let selectedToken = $state<'ICP' | 'ckUSDC'>('ICP');

	const handleSend = async () => {
		if (!recipient || !amount) {
			return;
		}
		try {
			// In a real app we'd parse the amount properly
			// const _amt = BigInt(parseFloat(amount) * 100_000_000);
			if (selectedToken === 'ICP') {
				await sendICP();
			} else {
				await sendCkUSDC();
			}
			// Refresh
			balances = await getBalances();
			transactions = await getTransactions();
			amount = '';
			recipient = '';
			alert('Transaction successful!');
		} catch (e: unknown) {
			alert((e as Error).message);
		}
	};
</script>

<div class="space-y-12">
	<SectionHeader
		description="Manage your ICP and ckUSDC balances. Securely send and receive tokens on the Internet Computer."
		highlight="Wallet"
		title="Your"
	/>

	<!-- Balances Cards -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="lg:col-span-1">
			<WalletStats {balances} onFormatBalance={formatBalance} />
		</div>
		<div class="lg:col-span-2">
			<CollateralStats
				collateral={balances.collateral}
				onFormatBalance={formatBalance}
				onManage={() => (isCollateralModalOpen = true)}
			/>
		</div>
	</div>

	<CollateralModal
		isOpen={isCollateralModalOpen}
		onClose={() => (isCollateralModalOpen = false)}
		onSuccess={async () => {
			balances = await getBalances();
		}}
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
				<WalletHistory onFormatBalance={formatBalance} {transactions} />
			{/if}
		</div>
	</div>
</div>
