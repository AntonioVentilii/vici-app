<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { settleMarket } from '$lib/services/resolution.services';
	import type { Market } from '$lib/types/market';

	interface Props {
		market: Market;
		onSettled: () => void;
	}

	const { market, onSettled }: Props = $props();

	let settlementPrice = $state('');
	let selectedOutcomeId = $state('');
	let loading = $state(false);
	let error = $state('');

	const isExpired = $derived(market.expiryDate < BigInt(Date.now()));
	const isUrgent = $derived(isExpired && market.status !== 'Resolved');
	const isCategorical = $derived(market.payoffType === 'Categorical');

	const handleSettle = async () => {
		if (isCategorical) {
			if (!selectedOutcomeId) {
				error = 'Please select a winning outcome';
				return;
			}
		} else {
			if (!settlementPrice || parseFloat(settlementPrice) < 0) {
				error = 'Please enter a valid settlement price';
				return;
			}
		}

		loading = true;
		error = '';

		try {
			if (isCategorical) {
				await settleMarket({ seriesId: market.id, outcomeId: selectedOutcomeId });
			} else {
				// Clearing uses token decimals format for prices
				const price = BigInt(Math.floor(parseFloat(settlementPrice) * 10 ** market.token.decimals));
				await settleMarket({ seriesId: market.id, settlementPrice: price });
			}
			onSettled();
			alert('Market successfully settled!');
		} catch (e: unknown) {
			error = (e as Error).message ?? 'Settlement failed';
		} finally {
			loading = false;
		}
	};
</script>

<Card padding="lg" variant={isUrgent ? 'default' : 'outline'}>
	<div class="space-y-6">
		{#if isUrgent}
			<div class="flex items-center gap-2">
				<Badge variant="danger">URGENT: NEEDS SETTLEMENT</Badge>
			</div>
		{/if}

		<div>
			<h3 class="text-lg font-black text-slate-950 uppercase">Admin Resolution</h3>
			<p class="mt-2 text-xs text-slate-500">
				{isCategorical
					? 'Select the winning outcome to settle this market.'
					: 'Enter the final price (e.g. 1.00 for YES, 0.00 for NO) to settle this market.'}
			</p>
		</div>

		<div class="space-y-4">
			{#if isCategorical}
				<div class="grid grid-cols-1 gap-2">
					{#each market.outcomes ?? [] as outcome (outcome.id)}
						<button
							class="flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 transition-all {selectedOutcomeId ===
							outcome.id
								? 'border-indigo-600 bg-indigo-50 text-indigo-700'
								: 'border-slate-100 bg-white text-slate-600 hover:border-slate-200'}"
							onclick={() => (selectedOutcomeId = outcome.id)}
							type="button"
						>
							<span class="font-bold">{outcome.title}</span>
							{#if selectedOutcomeId === outcome.id}
								<div class="h-2 w-2 rounded-full bg-indigo-600"></div>
							{/if}
						</button>
					{/each}
				</div>
			{:else}
				<div class="space-y-4">
					<div class="flex gap-2">
						<Button
							class="flex-1"
							onclick={() => (settlementPrice = '1.0')}
							size="sm"
							variant={settlementPrice === '1.0' ? 'primary' : 'outline'}
						>
							Settle YES (1.0)
						</Button>
						<Button
							class="flex-1"
							onclick={() => (settlementPrice = '0.0')}
							size="sm"
							variant={settlementPrice === '0.0' ? 'primary' : 'outline'}
						>
							Settle NO (0.0)
						</Button>
					</div>
					<div class="space-y-2">
						<label
							class="text-[10px] font-bold tracking-widest text-slate-600 uppercase"
							for="settlement-price"
						>
							Custom Settlement Price ({market.token.symbol})
						</label>
						<div class="relative">
							<input
								id="settlement-price"
								class="focus:ring-primary w-full rounded-2xl border-none bg-slate-50 px-4 py-3 text-lg font-bold text-slate-950 ring-1 ring-slate-200 ring-inset focus:ring-2"
								placeholder="0.00"
								type="number"
								bind:value={settlementPrice}
							/>
						</div>
					</div>
				</div>
			{/if}

			{#if error}
				<div class="text-destructive text-xs font-medium">
					{error}
				</div>
			{/if}

			<Button
				onclick={handleSettle}
				size="lg"
				status={loading
					? 'pending'
					: (isCategorical && selectedOutcomeId) || (!isCategorical && settlementPrice !== '')
						? 'enabled'
						: 'disabled'}
				variant={isUrgent ? 'danger' : 'primary'}
			>
				Resolve & Settle Market
			</Button>
		</div>
	</div>
</Card>
