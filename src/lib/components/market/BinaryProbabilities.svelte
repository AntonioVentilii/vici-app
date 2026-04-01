<script lang="ts">
	import { formatProbability } from '$lib/utils/format.utils';

	interface Props {
		yesProbability: number;
		noProbability: number;
	}

	const { yesProbability, noProbability }: Props = $props();
</script>

<div
	class="border-destructive/20 bg-destructive/5 hover:bg-destructive/10 relative flex flex-col items-center rounded-2xl border p-4 transition-colors"
>
	<div class="text-destructive mb-1 text-[10px] font-bold tracking-widest uppercase">No</div>
	<div class="text-destructive font-serif text-2xl font-black">
		{formatProbability(noProbability)}
	</div>
</div>

<div
	class="border-success/20 bg-success/5 hover:bg-success/10 relative flex flex-col items-center rounded-2xl border p-4 transition-colors"
>
	<div class="text-success mb-1 text-[10px] font-bold tracking-widest uppercase">Yes</div>
	<div class="text-success font-serif text-2xl font-black">
		{formatProbability(yesProbability)}
	</div>
</div>
