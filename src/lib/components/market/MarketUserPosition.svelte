<script lang="ts">
	import { ZERO } from '$lib/constants/app.constants';
	import type { Position } from '$lib/types/position';
	import { formatCurrency, formatQuantity } from '$lib/utils/format.utils';

	interface Props {
		position: Position | undefined;
		tokenDecimals: number;
	}

	const { position, tokenDecimals }: Props = $props();

	const isYes = $derived(position?.outcomeId === 'YES');
	const isNo = $derived(position?.outcomeId === 'NO');

	const displayOutcome = $derived(position?.outcomeId ?? 'Unknown');

	const absQty = $derived(
		position ? (position.netQty < ZERO ? -position.netQty : position.netQty) : ZERO
	);
</script>

{#if position && absQty > ZERO}
	<div class="border-primary/20 bg-primary/5 rounded-3xl border p-6">
		<h3 class="text-primary text-xs font-bold tracking-widest uppercase">Your Position</h3>

		<div class="mt-4 flex items-center justify-between">
			<div class="flex flex-col">
				<span class="text-foreground text-2xl font-black">
					{formatQuantity({ value: absQty, decimals: tokenDecimals })} Qty
				</span>
				<div class="flex items-center gap-2">
					<span
						class="text-xs font-bold {isYes
							? 'text-yes'
							: isNo
								? 'text-destructive'
								: 'text-primary'} uppercase"
					>
						{displayOutcome}
					</span>
					<span class="text-muted-foreground text-[10px]">•</span>
					<span class="text-muted-foreground text-[10px] font-medium">
						Locked: {formatCurrency({ value: position.lockedCollateral, decimals: 6 })}
					</span>
				</div>
			</div>

			<div class="bg-card flex h-10 w-10 items-center justify-center rounded-2xl p-2">
				{#if isYes}
					<svg class="text-yes h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							d="M5 13l4 4L19 7"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="3"
						/>
					</svg>
				{:else if isNo}
					<svg
						class="text-destructive h-6 w-6"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							d="M6 18L18 6M6 6l12 12"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="3"
						/>
					</svg>
				{:else}
					<svg class="text-primary h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="3"
						/>
					</svg>
				{/if}
			</div>
		</div>
	</div>
{/if}
