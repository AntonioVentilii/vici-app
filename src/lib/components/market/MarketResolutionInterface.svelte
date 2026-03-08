<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
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
	let loading = $state(false);
	let error = $state('');

	const isExpired = $derived(market.expiryDate < BigInt(Date.now()));
	const isUrgent = $derived(isExpired && market.status !== 'Resolved');

	const handleSettle = async () => {
		if (!settlementPrice || parseFloat(settlementPrice) < 0) {
			error = 'Please enter a valid settlement price';
			return;
		}

		loading = true;
		error = '';

		try {
			// Clearing uses token decimals format for prices
			const price = BigInt(Math.floor(parseFloat(settlementPrice) * 10 ** market.token.decimals));
			await settleMarket({ seriesId: market.id, settlementPrice: price });
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
			<p class="mt-2 text-xs text-slate-500">Enter the final price to settle this market series.</p>
		</div>

		<div class="space-y-4">
			<div class="space-y-2">
				<label
					class="text-[10px] font-bold tracking-widest text-slate-600 uppercase"
					for="settlement-price"
				>
					Settlement Price ({market.token.symbol})
				</label>
				<div class="relative">
					<input
						id="settlement-price"
						class="focus:ring-primary w-full rounded-2xl border-none bg-slate-50 px-4 py-3 text-lg font-bold text-slate-950 ring-1 ring-slate-200 ring-inset focus:ring-2"
						placeholder="0.00"
						type="number"
						bind:value={settlementPrice}
					/>
					<span class="absolute top-1/2 right-4 -translate-y-1/2 text-xs font-bold text-slate-400">
						{market.token.symbol}
					</span>
				</div>
			</div>

			{#if error}
				<div class="text-destructive text-xs font-medium">
					{error}
				</div>
			{/if}

			<Button
				onclick={handleSettle}
				size="lg"
				state={loading ? 'pending' : nonNullish(settlementPrice) ? 'enabled' : 'disabled'}
				variant={isUrgent ? 'danger' : 'primary'}
			>
				Resolve & Settle
			</Button>
		</div>
	</div>
</Card>
