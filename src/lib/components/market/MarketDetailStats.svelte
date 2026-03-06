<script lang="ts">
	import { formatVolume } from '$lib/utils/format.utils';

	interface Props {
		totalVolume: bigint;
		expiryDate: bigint;
		timeRemaining: string;
	}

	const { totalVolume, expiryDate, timeRemaining }: Props = $props();
</script>

<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
	<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Total Volume</div>
		<div class="mt-1 text-xl font-black text-slate-950">
			{formatVolume(totalVolume)} ICP
		</div>
	</div>
	<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Expiry Date</div>
		<div class="mt-1 text-xl font-black text-slate-950">
			{new Date(Number(expiryDate)).toLocaleDateString()}
		</div>
	</div>
	<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Time Remaining</div>
		<div class="mt-1 text-xl font-black text-indigo-600">
			{timeRemaining}
		</div>
	</div>
</div>
