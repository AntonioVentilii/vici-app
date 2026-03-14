<script lang="ts">
	import PredictionInterface from '$lib/components/market/PredictionInterface.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import type { Market, OutcomeId } from '$lib/types/market';

	interface Props {
		market: Market;
		selectedOutcome: OutcomeId;
		onClose: () => void;
		onPredictionPlaced: () => void;
	}

	const { market, selectedOutcome, onClose, onPredictionPlaced }: Props = $props();

	const handleClose = () => {
		onClose();
	};
</script>

<Modal isOpen={true} {onClose}>
	<div class="relative overflow-hidden">
		<!-- Header -->
		<div class="mb-6 flex items-center justify-between border-b border-slate-50 pb-4">
			<h2 class="text-lg font-black text-slate-900">Confirm Prediction</h2>
			<button
				class="rounded-full p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
				aria-label="Close"
				onclick={handleClose}
				title="Close"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						d="M6 18L18 6M6 6l12 12"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
					/>
				</svg>
			</button>
		</div>

		<div class="space-y-6">
			<div class="rounded-2xl bg-slate-50 p-4">
				<span class="text-[10px] font-bold tracking-widest text-slate-400 uppercase"
					>Predicting on</span
				>
				<div class="mt-1 flex items-baseline justify-between">
					<span class="text-xl font-black text-slate-900">
						{market.payoffType === 'Binary'
							? selectedOutcome
							: (market.outcomes?.find((o) => o.id === selectedOutcome)?.title ?? selectedOutcome)}
					</span>
					<div class="flex flex-col items-end">
						<span class="text-xs font-bold text-indigo-600 uppercase">Current Chance</span>
						<span class="text-lg font-black text-indigo-600">
							{Math.round(
								(selectedOutcome === 'YES'
									? market.yesProbability
									: selectedOutcome === 'NO'
										? market.noProbability
										: (market.outcomes?.find((o) => o.id === selectedOutcome)?.probability ??
											0.5)) * 100
							)}%
						</span>
					</div>
				</div>
			</div>

			<PredictionInterface
				{market}
				onPredictionPlaced={() => {
					onPredictionPlaced();
					handleClose();
				}}
			/>
		</div>
	</div>
</Modal>
