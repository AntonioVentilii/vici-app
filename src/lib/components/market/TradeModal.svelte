<script lang="ts">
	import PredictionInterface from '$lib/components/market/PredictionInterface.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market, OutcomeId } from '$lib/types/market';
	import { t } from '$lib/utils/i18n.utils';

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

	const selectedOutcomeLabel = $derived.by(() => {
		if (selectedOutcome === 'YES') {
			return t({ locale: $localeStore, key: 'outcome.yes' });
		}

		if (selectedOutcome === 'NO') {
			return t({ locale: $localeStore, key: 'outcome.no' });
		}

		return market.outcomes?.find((o) => o.id === selectedOutcome)?.title ?? selectedOutcome;
	});
</script>

<Modal isOpen={true} {onClose}>
	<div class="relative overflow-hidden">
		<div class="space-y-6">
			<div class="bg-foreground/5 flex flex-row items-center justify-between rounded-2xl p-4">
				<div class="flex flex-col">
					<span class="text-muted-foreground eyebrow-xs">
						{t({ locale: $localeStore, key: 'trade.predicting_on' })}
					</span>

					<span class="text-foreground text-xl font-black">
						{selectedOutcomeLabel}
					</span>
				</div>

				<div class="flex flex-col items-end">
					<span class="text-primary text-[10px] font-bold uppercase">
						{t({ locale: $localeStore, key: 'trade.current_chance' })}
					</span>

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
