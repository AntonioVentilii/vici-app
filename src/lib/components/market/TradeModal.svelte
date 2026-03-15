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
		<div class="space-y-6">
			<div class=" items center flex flex-row justify-between rounded-2xl bg-slate-50 p-4">
				<div class="flex flex-col">
					<span class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
						Predicting on
					</span>

					<span class="text-xl font-black text-slate-900">
						{market.payoffType === 'Binary'
							? selectedOutcome
							: (market.outcomes?.find((o) => o.id === selectedOutcome)?.title ?? selectedOutcome)}
					</span>
				</div>

				<div class="flex flex-col items-end">
					<span class="text-[10px] font-bold text-indigo-600 uppercase">Current Chance</span>

					<span class="text-lg font-black text-indigo-600">
						{Math.round(
							(selectedOutcome === 'YES'
								? market.yesProbability
								: selectedOutcome === 'NO'
									? market.noProbability
									: (market.outcomes?.find((o) => o.id === selectedOutcome)?.probability ?? 0.5)) *
								100
						)}%
					</span>
				</div>
			</div>

			<PredictionInterface
				hideSelector={true}
				initialType={selectedOutcome}
				{market}
				onPredictionPlaced={() => {
					onPredictionPlaced();
					handleClose();
				}}
			/>
		</div>
	</div>
</Modal>
