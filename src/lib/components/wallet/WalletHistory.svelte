<script lang="ts">
	import PrincipalText from '$lib/components/ui/PrincipalText.svelte';
	import type { Transaction } from '$lib/types/wallet';
	import { formatNanosecondsToDate, formatToken } from '$lib/utils/format.utils';

	interface Props {
		transactions: Transaction[];
	}

	const { transactions }: Props = $props();
</script>

<div class="overflow-x-auto">
	{#if transactions.length === 0}
		<div class="text-muted-foreground py-12 text-center">No transactions yet.</div>
	{:else}
		<table class="w-full text-left">
			<thead>
				<tr
					class="border-border text-muted-foreground border-b text-[10px] tracking-widest uppercase"
				>
					<th class="pb-4 font-bold">Date</th>
					<th class="pb-4 font-bold">Type</th>
					<th class="pb-4 font-bold">Token</th>
					<th class="pb-4 font-bold">Amount</th>
					<th class="pb-4 font-bold">Details</th>
				</tr>
			</thead>
			<tbody class="divide-border/50 divide-y">
				{#each transactions as { id, timestamp, type, token, amount, marketId, counterparty } (`${id}-${token.symbol}`)}
					<tr class="text-sm">
						<td class="text-muted-foreground py-4">
							{formatNanosecondsToDate({ nanoseconds: timestamp })}
						</td>
						<td
							class="py-4 font-bold"
							class:text-[var(--yes)]={type === 'Receive'}
							class:text-primary={type !== 'Receive' && type !== 'Send'}
							class:text-destructive={type === 'Send'}
						>
							{type}
						</td>
						<td class="text-foreground py-4 uppercase">{token.symbol}</td>
						<td class="text-foreground py-4 font-bold">
							{formatToken({ value: amount, unitName: token.decimals })}
						</td>
						<td class="text-muted-foreground py-4">
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
