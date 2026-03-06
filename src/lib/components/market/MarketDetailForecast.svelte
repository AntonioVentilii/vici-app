<script lang="ts">
	import { formatVolume } from '$lib/utils/format.utils';

	interface Props {
		yesProbability: number;
		noProbability: number;
		yesVolume: bigint;
		noVolume: bigint;
	}

	const { yesProbability, noProbability, yesVolume, noVolume }: Props = $props();
</script>

<div class="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
	<h3 class="text-sm font-bold tracking-widest text-slate-500 uppercase">Market Forecast</h3>

	<div class="relative mt-4">
		<div class="mb-1.5 flex justify-between">
			<div class="flex flex-col">
				<span class="text-2xl font-black text-slate-950">{Math.round(yesProbability * 100)}%</span>
				<span class="text-[10px] font-bold text-green-600 uppercase">YES Probability</span>
			</div>
			<div class="flex flex-col items-end">
				<span class="text-2xl font-black text-slate-950">{Math.round(noProbability * 100)}%</span>
				<span class="text-[10px] font-bold text-red-600 uppercase">NO Probability</span>
			</div>
		</div>
		<div class="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
			<div
				style="width: {yesProbability * 100}%"
				class="h-full bg-green-500 transition-all duration-700"
			></div>
			<div
				style="width: {noProbability * 100}%"
				class="h-full bg-red-500 transition-all duration-700"
			></div>
		</div>
	</div>

	<div class="mt-6 grid grid-cols-2 gap-6 border-t border-slate-100 pt-6">
		<div>
			<div class="mb-0.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
				YES Vol
			</div>
			<div class="text-lg font-bold text-slate-950">{formatVolume(yesVolume)} ICP</div>
		</div>
		<div class="text-right">
			<div class="mb-0.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
				NO Vol
			</div>
			<div class="text-lg font-bold text-slate-950">{formatVolume(noVolume)} ICP</div>
		</div>
	</div>
</div>
