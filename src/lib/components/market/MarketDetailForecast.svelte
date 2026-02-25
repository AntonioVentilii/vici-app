<script lang="ts">
	interface Props {
		yesProbability: number;
		noProbability: number;
		yesVolume: bigint;
		noVolume: bigint;
		onFormatVolume: (v: bigint) => string;
	}

	const { yesProbability, noProbability, yesVolume, noVolume, onFormatVolume }: Props = $props();
</script>

<div class="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
	<h3 class="text-lg font-bold tracking-widest text-slate-500 uppercase">Market Forecast</h3>

	<div class="relative mt-8">
		<div class="mb-2 flex justify-between">
			<div class="flex flex-col">
				<span class="text-3xl font-black text-slate-950">{Math.round(yesProbability * 100)}%</span>
				<span class="text-xs font-bold text-green-600 uppercase">YES Probability</span>
			</div>
			<div class="flex flex-col items-end">
				<span class="text-3xl font-black text-slate-950">{Math.round(noProbability * 100)}%</span>
				<span class="text-xs font-bold text-red-600 uppercase">NO Probability</span>
			</div>
		</div>
		<div class="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
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

	<div class="mt-12 grid grid-cols-2 gap-8 border-t border-slate-100 pt-8">
		<div>
			<div class="mb-1 text-xs font-bold tracking-widest text-slate-500 uppercase">YES Volume</div>
			<div class="text-xl font-bold text-slate-950">{onFormatVolume(yesVolume)} ICP</div>
		</div>
		<div class="text-right">
			<div class="mb-1 text-xs font-bold tracking-widest text-slate-500 uppercase">NO Volume</div>
			<div class="text-xl font-bold text-slate-950">{onFormatVolume(noVolume)} ICP</div>
		</div>
	</div>
</div>
