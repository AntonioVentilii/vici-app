<script lang="ts">
	import { onMount } from 'svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { mockBackend, type Transaction, type WalletBalance } from '$lib/services/mockBackend';

	let balances = $state<WalletBalance>({ icp: ZERO, ckUSDC: ZERO });
	let transactions = $state<Transaction[]>([]);
	let activeTab = $state('Send');

	const tabs = ['Send', 'Receive', 'History'];

	onMount(async () => {
		balances = await mockBackend.getBalances();
		transactions = await mockBackend.getTransactions();
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
			const amt = BigInt(parseFloat(amount) * 100_000_000);
			if (selectedToken === 'ICP') {
				await mockBackend.sendICP(recipient, amt);
			} else {
				await mockBackend.sendCkUSDC(recipient, amt);
			}
			// Refresh
			balances = await mockBackend.getBalances();
			transactions = await mockBackend.getTransactions();
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
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
		<div
			class="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 p-8 backdrop-blur-xl"
		>
			<div class="flex items-center justify-between">
				<div class="text-sm font-bold tracking-widest text-indigo-400 uppercase">ICP Balance</div>
				<div class="h-8 w-8 rounded-full bg-indigo-500/30 p-1.5 text-indigo-400">
					<svg fill="currentColor" viewBox="0 0 24 24"
						><path d="M12 2L2 12l10 10 10-10L12 2z" /></svg
					>
				</div>
			</div>
			<div class="mt-4 flex items-baseline gap-2">
				<span class="text-5xl font-black text-white">{formatBalance(balances.icp)}</span>
				<span class="text-xl font-bold text-gray-400 uppercase">ICP</span>
			</div>
			<div class="mt-6 flex gap-3 text-xs font-medium text-gray-400">
				<span>≈ ${((Number(balances.icp) / 100_000_000) * 12.5).toFixed(2)} USD</span>
			</div>
		</div>

		<div
			class="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-green-500/20 to-emerald-600/20 p-8 backdrop-blur-xl"
		>
			<div class="flex items-center justify-between">
				<div class="text-sm font-bold tracking-widest text-green-400 uppercase">ckUSDC Balance</div>
				<div class="h-8 w-8 rounded-full bg-green-500/30 p-1.5 text-green-400">
					<svg fill="currentColor" viewBox="0 0 24 24"
						><path d="M12 2L2 12l10 10 10-10L12 2z" /></svg
					>
				</div>
			</div>
			<div class="mt-4 flex items-baseline gap-2">
				<span class="text-5xl font-black text-white">{formatBalance(balances.ckUSDC)}</span>
				<span class="text-xl font-bold text-gray-400 uppercase">ckUSDC</span>
			</div>
			<div class="mt-6 flex gap-3 text-xs font-medium text-gray-400">
				<span>1.00 ckUSDC = $1.00 USD</span>
			</div>
		</div>
	</div>

	<!-- Operations Tabs -->
	<div class="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
		<div class="flex border-b border-white/10">
			{#each tabs as tab (tab)}
				<button
					class="flex-1 py-4 text-sm font-bold transition-all {activeTab === tab
						? 'border-b-2 border-indigo-500 bg-white/5 text-white'
						: 'text-gray-500 hover:bg-white/5 hover:text-white'}"
					onclick={() => (activeTab = tab)}
				>
					{tab}
				</button>
			{/each}
		</div>

		<div class="p-8">
			{#if activeTab === 'Send'}
				<div class="max-w-xl space-y-6">
					<div class="space-y-2">
						<label class="text-xs font-bold tracking-wider text-gray-500 uppercase">Token</label>
						<div class="grid grid-cols-2 gap-4">
							<button
								class="rounded-xl border-2 px-4 py-3 transition-all {selectedToken === 'ICP'
									? 'border-indigo-500 bg-indigo-500/10 text-white'
									: 'border-white/5 bg-white/5 text-gray-400 hover:border-white/10'}"
								onclick={() => (selectedToken = 'ICP')}
							>
								ICP
							</button>
							<button
								class="rounded-xl border-2 px-4 py-3 transition-all {selectedToken === 'ckUSDC'
									? 'border-green-500 bg-green-500/10 text-white'
									: 'border-white/5 bg-white/5 text-gray-400 hover:border-white/10'}"
								onclick={() => (selectedToken = 'ckUSDC')}
							>
								ckUSDC
							</button>
						</div>
					</div>

					<div class="space-y-2">
						<label class="text-xs font-bold tracking-wider text-gray-500 uppercase"
							>Recipient Principal</label
						>
						<input
							class="w-full rounded-xl border-none bg-white/5 px-4 py-3 text-white ring-1 ring-white/10 ring-inset focus:ring-2 focus:ring-indigo-500"
							placeholder="aaaaa-aa..."
							type="text"
							bind:value={recipient}
						/>
					</div>

					<div class="space-y-2">
						<label class="text-xs font-bold tracking-wider text-gray-500 uppercase">Amount</label>
						<input
							class="w-full rounded-xl border-none bg-white/5 px-4 py-3 text-white ring-1 ring-white/10 ring-inset focus:ring-2 focus:ring-indigo-500"
							placeholder="0.00"
							type="number"
							bind:value={amount}
						/>
					</div>

					<button
						class="w-full rounded-xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-xl shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-[0.98]"
						onclick={handleSend}
					>
						Send Tokens
					</button>
				</div>
			{:else if activeTab === 'Receive'}
				<div class="flex flex-col items-center space-y-6 text-center">
					<div class="rounded-2xl bg-white p-4 shadow-2xl">
						<div class="flex h-48 w-48 items-center justify-center rounded-lg bg-gray-200">
							<!-- Placeholder QR -->
							<span class="text-xs font-bold text-black">QR CODE PLACEHOLDER</span>
						</div>
					</div>
					<div class="space-y-2">
						<p class="text-sm font-bold tracking-widest text-gray-500 uppercase">
							Your Principal ID
						</p>
						<div
							class="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2"
						>
							<code class="font-mono text-indigo-400">current-user-principal-xxxx-xxxx</code>
							<button
								class="text-gray-400 transition-colors hover:text-white"
								onclick={() => navigator.clipboard.writeText('current-user-principal-xxxx-xxxx')}
							>
								<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
									/>
								</svg>
							</button>
						</div>
					</div>
				</div>
			{:else if activeTab === 'History'}
				<div class="overflow-x-auto">
					{#if transactions.length === 0}
						<div class="py-12 text-center text-gray-500">No transactions yet.</div>
					{:else}
						<table class="w-full text-left">
							<thead>
								<tr
									class="border-b border-white/5 text-[10px] tracking-widest text-gray-500 uppercase"
								>
									<th class="pb-4 font-bold">Date</th>
									<th class="pb-4 font-bold">Type</th>
									<th class="pb-4 font-bold">Token</th>
									<th class="pb-4 font-bold">Amount</th>
									<th class="pb-4 font-bold">Details</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-white/5">
								{#each transactions as tx (tx.id)}
									<tr class="text-sm">
										<td class="py-4 text-white">{new Date(tx.timestamp).toLocaleString()}</td>
										<td
											class="py-4 font-bold {tx.type === 'Receive'
												? 'text-green-400'
												: 'text-indigo-400'}">{tx.type}</td
										>
										<td class="py-4 text-white uppercase">{tx.token}</td>
										<td class="py-4 font-bold text-white">{formatBalance(tx.amount)}</td>
										<td class="py-4 text-gray-400">
											{#if tx.marketId}
												Market Bet ID: {tx.marketId}
											{:else if tx.counterparty}
												To/From: {tx.counterparty.substring(0, 10)}...
											{:else}
												-
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
