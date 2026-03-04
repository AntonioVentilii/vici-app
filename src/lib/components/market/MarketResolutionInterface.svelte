<script lang="ts">
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
			// Clearing uses e8 format for prices
			const price = BigInt(Math.floor(parseFloat(settlementPrice) * 100_000_000));
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

<div
	class="rounded-3xl border p-6 shadow-sm transition-colors {isUrgent
		? 'border-red-200 bg-red-50'
		: 'border-indigo-200 bg-indigo-50'}"
>
	{#if isUrgent}
		<div class="mb-4 flex items-center gap-2 text-red-600">
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="3"
				/>
			</svg>
			<span class="text-[10px] font-bold tracking-widest uppercase">Urgent: Needs Settlement</span>
		</div>
	{/if}

	<h3 class="text-lg font-black uppercase {isUrgent ? 'text-red-950' : 'text-indigo-950'}">
		Admin Resolution
	</h3>
	<p class="mt-2 text-xs text-indigo-700">Enter the final price to settle this market series.</p>

	<div class="mt-6 space-y-4">
		<div class="space-y-2">
			<label
				class="text-[10px] font-bold tracking-widest text-indigo-600 uppercase"
				for="settlement-price"
			>
				Settlement Price (ICP)
			</label>
			<div class="relative">
				<input
					id="settlement-price"
					class="w-full rounded-2xl border-none bg-white px-4 py-3 text-lg font-bold text-slate-950 ring-1 ring-indigo-200 ring-inset focus:ring-2 focus:ring-indigo-600"
					placeholder="0.00"
					type="number"
					bind:value={settlementPrice}
				/>
				<span class="absolute top-1/2 right-4 -translate-y-1/2 text-xs font-bold text-slate-400"
					>ICP</span
				>
			</div>
		</div>

		{#if error}
			<div class="text-xs font-medium text-red-600">
				{error}
			</div>
		{/if}

		<button
			class="w-full rounded-2xl py-3 text-sm font-black text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 {isUrgent
				? 'bg-red-600 shadow-red-500/20 hover:bg-red-700'
				: 'bg-indigo-600 shadow-indigo-500/20 hover:bg-indigo-700'}"
			disabled={loading || !settlementPrice}
			onclick={handleSettle}
		>
			{#if loading}
				Settling...
			{:else}
				Resolve & Settle
			{/if}
		</button>
	</div>
</div>
