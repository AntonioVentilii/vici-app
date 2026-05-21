<script lang="ts">
	import PrincipalText from '$lib/components/ui/PrincipalText.svelte';
	import type { Transaction } from '$lib/types/wallet';
	import { formatNanosecondsToDate, formatToken } from '$lib/utils/format.utils';

	interface Props {
		transactions: Transaction[];
	}

	const { transactions }: Props = $props();
</script>

<div class="border-border bg-foreground/3 overflow-x-auto rounded-2xl border">
	{#if transactions.length === 0}
		<div class="text-muted-foreground py-12 text-center text-sm">No transactions yet.</div>
	{:else}
		<table class="w-full text-left text-sm">
			<thead>
				<tr
					class="border-border text-muted-foreground bg-foreground/5 border-b text-[10px] tracking-widest uppercase"
				>
					<th class="px-4 py-3 font-bold">Date</th>
					<th class="px-4 py-3 font-bold">Type</th>
					<th class="px-4 py-3 font-bold">Token</th>
					<th class="px-4 py-3 font-bold">Amount</th>
					<th class="px-4 py-3 font-bold">Details</th>
				</tr>
			</thead>
			<tbody class="divide-border/50 divide-y">
				{#each transactions as { id, timestamp, type, token, amount, marketId, counterparty } (`${id}-${token.symbol}`)}
					<tr class="hover:bg-foreground/5 transition-colors">
						<td class="text-muted-foreground px-4 py-3">
							{formatNanosecondsToDate({ nanoseconds: timestamp })}
						</td>
						<td
							class="px-4 py-3 font-bold"
							class:text-destructive={type === 'Send'}
							class:text-primary={type !== 'Receive' && type !== 'Send'}
							class:text-yes={type === 'Receive'}
						>
							{type}
						</td>
						<td class="text-foreground px-4 py-3 uppercase">{token.symbol}</td>
						<td class="text-foreground num px-4 py-3 font-bold">
							{formatToken({ value: amount, unitName: token.decimals })}
						</td>
						<td class="text-muted-foreground px-4 py-3">
							{#if marketId}
								Market Prediction ID: {marketId}
							{:else if counterparty}
								To/From: <PrincipalText principal={counterparty} />
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
