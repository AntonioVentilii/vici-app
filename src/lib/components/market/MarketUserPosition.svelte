<script lang="ts">
	import { ZERO } from '$lib/constants/app.constants';
	import type { Position } from '$lib/types/position';

	interface Props {
		position: Position | undefined;
		onFormatBalance: (b: bigint) => string;
	}

	const { position, onFormatBalance }: Props = $props();

	const isYes = $derived(position ? position.yesAmount > ZERO : false);
	const absQty = $derived(position ? (isYes ? position.yesAmount : position.noAmount) : ZERO);
</script>

{#if position && absQty > ZERO}
	<div
		class="rounded-3xl border border-indigo-100 bg-linear-to-br from-indigo-50 to-white p-6 shadow-sm"
	>
		<h3 class="text-xs font-bold tracking-widest text-indigo-600 uppercase">Your Position</h3>

		<div class="mt-4 flex items-center justify-between">
			<div class="flex flex-col">
				<span class="text-2xl font-black text-slate-950">
					{onFormatBalance(absQty)} Shares
				</span>
				<div class="flex items-center gap-2">
					<span class="text-xs font-bold {isYes ? 'text-green-600' : 'text-red-600'} uppercase">
						{isYes ? 'YES' : 'NO'}
					</span>
					<span class="text-[10px] text-slate-400">•</span>
					<span class="text-[10px] font-medium text-slate-500">
						Locked: {onFormatBalance(position.lockedCollateral)} ICP
					</span>
				</div>
			</div>

			<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
				{#if isYes}
					<svg class="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							d="M5 13l4 4L19 7"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="3"
						/>
					</svg>
				{:else}
					<svg class="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							d="M6 18L18 6M6 6l12 12"
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
