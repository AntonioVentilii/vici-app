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
			<div class=" items center bg-foreground/5 flex flex-row justify-between rounded-2xl p-4">
				<div class="flex flex-col">
					<span class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
						Predicting on
					</span>

					<span class="text-foreground text-xl font-black">
						{market.payoffType === 'Binary'
							? selectedOutcome
							: (market.outcomes?.find((o) => o.id === selectedOutcome)?.title ?? selectedOutcome)}
					</span>
				</div>

				<div class="flex flex-col items-end">
					<span class="text-primary text-[10px] font-bold uppercase">Current Chance</span>

					<span class="text-primary text-lg font-black">
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
