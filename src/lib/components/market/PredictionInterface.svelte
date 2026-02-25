<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { mockBackend, type Market, type PositionType } from '$lib/services/mockBackend';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();
	const dispatch = createEventDispatcher();

	let amount = $state('');
	let selectedType = $state<PositionType>('YES');
	let loading = $state(false);
	let error = $state('');

	const handlePlacePrediction = async () => {
		if (!amount || parseFloat(amount) <= 0) {
			error = 'Please enter a valid amount';
			return;
		}

		loading = true;
		error = '';

		try {
			const amt = BigInt(Math.floor(parseFloat(amount) * 100_000_000));
			await mockBackend.placePrediction(market.id, selectedType, amt, 'ICP');
			amount = '';
			dispatch('predictionPlaced');
			alert(`Successfully placed ${selectedType} prediction!`);
		} catch (e: unknown) {
			error = (e as Error).message ?? 'Failed to place prediction';
		} finally {
			loading = false;
		}
	};

	const estimatedPayout = $derived(() => {
		if (!amount) {
			return 0;
		}
		const amt = parseFloat(amount);
		const prob = selectedType === 'YES' ? market.yesProbability : market.noProbability;
		if (prob === 0) {
			return 0;
		}
		return (amt / prob).toFixed(2);
	});
</script>

<div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
	<h3 class="text-xl font-bold text-slate-950">Place a Prediction</h3>
	<p class="mt-2 text-sm text-slate-600">
		Select an outcome and enter your prediction amount in ICP.
	</p>

	<div class="mt-8 space-y-6">
		<!-- Outcome Selector -->
		<div class="grid grid-cols-2 gap-4">
			<button
				class="group relative overflow-hidden rounded-2xl border-2 px-6 py-4 transition-all {selectedType ===
				'YES'
					? 'border-green-500 bg-green-50 text-green-700'
					: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
				onclick={() => (selectedType = 'YES')}
			>
				<div class="relative z-10 flex flex-col items-center gap-1">
					<span class="text-xs font-bold tracking-widest uppercase">Predict</span>
					<span class="text-2xl font-black">YES</span>
				</div>
				{#if selectedType === 'YES'}
					<div class="absolute inset-0 bg-green-500/20 blur-2xl"></div>
				{/if}
			</button>

			<button
				class="group relative overflow-hidden rounded-2xl border-2 px-6 py-4 transition-all {selectedType ===
				'NO'
					? 'border-red-500 bg-red-50 text-red-700'
					: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
				onclick={() => (selectedType = 'NO')}
			>
				<div class="relative z-10 flex flex-col items-center gap-1">
					<span class="text-xs font-bold tracking-widest uppercase">Predict</span>
					<span class="text-2xl font-black">NO</span>
				</div>
				{#if selectedType === 'NO'}
					<div class="absolute inset-0 bg-red-500/20 blur-2xl"></div>
				{/if}
			</button>
		</div>

		<!-- Amount Input -->
		<div class="space-y-2">
			<div class="flex justify-between">
				<label class="text-xs font-bold tracking-widest text-slate-500 uppercase" for="amount"
					>Amount (ICP)</label
				>
				<span class="text-xs text-slate-400">Balance: Wallet mocked</span>
			</div>
			<div class="relative">
				<input
					id="amount"
					class="w-full rounded-2xl border-none bg-slate-50 px-6 py-4 text-xl font-bold text-slate-950 ring-1 ring-slate-200 transition-all ring-inset focus:bg-white focus:ring-2 focus:ring-indigo-500"
					placeholder="0.00"
					type="number"
					bind:value={amount}
				/>
				<div class="absolute top-1/2 right-4 -translate-y-1/2 text-sm font-bold text-slate-500">
					ICP
				</div>
			</div>
		</div>

		<!-- Error Message -->
		{#if error}
			<div class="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
				{error}
			</div>
		{/if}

		<!-- Payout Summary -->
		<div class="space-y-3 rounded-2xl bg-slate-50 p-5">
			<div class="flex justify-between text-sm">
				<span class="text-slate-500">Estimated Payout</span>
				<span class="font-bold text-slate-950">{estimatedPayout()} ICP</span>
			</div>
			<div class="flex justify-between text-sm">
				<span class="text-slate-500">Potential Return</span>
				<span class="font-bold text-green-400"
					>{amount
						? (
								(parseFloat(estimatedPayout().toString()) / parseFloat(amount || '1') - 1) *
								100
							).toFixed(1)
						: 0}%</span
				>
			</div>
		</div>

		<!-- Action Button -->
		<button
			class="group relative w-full overflow-hidden rounded-2xl bg-indigo-600 py-5 text-lg font-black text-white shadow-2xl shadow-indigo-500/40 transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
			disabled={loading || !amount}
			onclick={handlePlacePrediction}
		>
			{#if loading}
				<div class="flex items-center justify-center gap-2">
					<div
						class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
					></div>
					Processing...
				</div>
			{:else}
				Confirm {selectedType} Prediction
			{/if}
			<div
				class="absolute inset-x-0 bottom-0 h-1 bg-white/20 transition-all group-hover:bg-white/40"
			></div>
		</button>
	</div>
</div>
