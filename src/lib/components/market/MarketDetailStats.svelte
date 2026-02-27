<script lang="ts">
	interface Props {
		totalVolume: bigint;
		expiryDate: bigint;
		timeRemaining: string;
		onFormatVolume: (v: bigint) => string;
	}

	const { totalVolume, expiryDate, timeRemaining, onFormatVolume }: Props = $props();
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
	<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
		<div class="text-xs font-bold tracking-widest text-slate-500 uppercase">Total Volume</div>
		<div class="mt-2 text-2xl font-black text-slate-950">
			{onFormatVolume(totalVolume)} ICP
		</div>
	</div>
	<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
		<div class="text-xs font-bold tracking-widest text-slate-500 uppercase">Expiry Date</div>
		<div class="mt-2 text-2xl font-black text-slate-950">
			{new Date(Number(expiryDate)).toLocaleDateString()}
		</div>
	</div>
	<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
		<div class="text-xs font-bold tracking-widest text-slate-500 uppercase">Time Remaining</div>
		<div class="mt-2 text-2xl font-black text-indigo-600">
			{timeRemaining}
		</div>
	</div>
</div>
