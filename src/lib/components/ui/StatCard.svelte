<script lang="ts">
	interface Props {
		label: string;
		value: string | number;
		unit?: string;
		class?: string;
		valueClass?: string;
	}

	const { label, value, unit, class: className = '', valueClass = '' }: Props = $props();
</script>

<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm {className}">
	<div class="text-[10px] font-bold tracking-widest text-slate-500 uppercase">{label}</div>
	<div class="mt-1 flex items-baseline gap-2">
		<span class="text-2xl font-black text-slate-950 {valueClass}">{value}</span>
		{#if unit}
			<span class="text-xs font-bold text-slate-500 uppercase">{unit}</span>
		{/if}
	</div>
</div>
