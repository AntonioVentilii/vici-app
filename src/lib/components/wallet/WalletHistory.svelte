<script lang="ts">
	import type { Transaction } from '$lib/types/wallet';

	interface Props {
		transactions: Transaction[];
		onFormatBalance: (b: bigint) => string;
	}

	const { transactions, onFormatBalance }: Props = $props();
</script>

<div class="overflow-x-auto">
	{#if transactions.length === 0}
		<div class="py-12 text-center text-slate-500">No transactions yet.</div>
	{:else}
		<table class="w-full text-left">
			<thead>
				<tr class="border-b border-slate-100 text-[10px] tracking-widest text-slate-500 uppercase">
					<th class="pb-4 font-bold">Date</th>
					<th class="pb-4 font-bold">Type</th>
					<th class="pb-4 font-bold">Token</th>
					<th class="pb-4 font-bold">Amount</th>
					<th class="pb-4 font-bold">Details</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-50">
				{#each transactions as tx (tx.id)}
					<tr class="text-sm">
						<td class="py-4 text-slate-600">{new Date(tx.timestamp).toLocaleString()}</td>
						<td
							class="py-4 font-bold {tx.type === 'Receive' ? 'text-green-600' : 'text-indigo-600'}"
							>{tx.type}</td
						>
						<td class="py-4 text-slate-950 uppercase">{tx.token}</td>
						<td class="py-4 font-bold text-slate-950">{onFormatBalance(tx.amount)}</td>
						<td class="py-4 text-slate-500">
							{#if tx.marketId}
								Market Prediction ID: {tx.marketId}
							{:else if tx.counterparty}
								To/From: {tx.counterparty.toText().substring(0, 10)}...
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
