<script lang="ts">
	import type { Transaction } from '$lib/types/wallet';
	import { formatBalance, formatNanosecondsToDate } from '$lib/utils/format.utils';

	interface Props {
		transactions: Transaction[];
	}

	const { transactions }: Props = $props();
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
				{#each transactions as { id, timestamp, type, token, amount, marketId, counterparty } (id)}
					<tr class="text-sm">
						<td class="py-4 text-slate-600">
							{formatNanosecondsToDate({ nanoseconds: timestamp })}
						</td>
						<td
							class="py-4 font-bold"
							class:text-green-600={type === 'Receive'}
							class:text-indigo-600={type !== 'Receive' && type !== 'Send'}
							class:text-red-600={type === 'Send'}
						>
							{type}
						</td>
						<td class="py-4 text-slate-950 uppercase">{token}</td>
						<td class="py-4 font-bold text-slate-950">{formatBalance(amount)}</td>
						<td class="py-4 text-slate-500">
							{#if marketId}
								Market Prediction ID: {marketId}
							{:else if counterparty}
								To/From: {counterparty.substring(0, 10)}...
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
