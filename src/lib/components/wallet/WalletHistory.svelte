<script lang="ts">
	import PrincipalText from '$lib/components/ui/PrincipalText.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Transaction } from '$lib/types/wallet';
	import { formatNanosecondsToDate, formatToken } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		transactions: Transaction[];
	}

	const { transactions }: Props = $props();
</script>

<div class="border-border bg-foreground/3 overflow-x-auto rounded-2xl border">
	{#if transactions.length === 0}
		<div class="text-muted-foreground py-12 text-center text-sm">
			{t({ locale: $localeStore, key: 'wallet.history.empty' })}
		</div>
	{:else}
		<table class="w-full text-left text-sm">
			<thead>
				<tr
					class="border-border text-muted-foreground bg-foreground/5 border-b text-[10px] tracking-widest uppercase"
				>
					<th class="px-4 py-3 font-bold">
						{t({ locale: $localeStore, key: 'wallet.history.col.date' })}
					</th>
					<th class="px-4 py-3 font-bold">
						{t({ locale: $localeStore, key: 'wallet.history.col.type' })}
					</th>
					<th class="px-4 py-3 font-bold">
						{t({ locale: $localeStore, key: 'wallet.history.col.token' })}
					</th>
					<th class="px-4 py-3 font-bold">
						{t({ locale: $localeStore, key: 'wallet.history.col.amount' })}
					</th>
					<th class="px-4 py-3 font-bold">
						{t({ locale: $localeStore, key: 'wallet.history.col.details' })}
					</th>
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
								{t({ locale: $localeStore, key: 'wallet.history.market_prediction_id' })}
								{marketId}
							{:else if counterparty}
								{t({ locale: $localeStore, key: 'wallet.history.to_from' })}
								<PrincipalText principal={counterparty} />
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
