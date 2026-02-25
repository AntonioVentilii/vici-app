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

<div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm {className}">
	<div class="text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">{label}</div>
	<div class="mt-2 flex items-baseline gap-2">
		<span class="text-4xl font-black text-slate-950 {valueClass}">{value}</span>
		{#if unit}
			<span class="text-sm font-bold text-slate-500 uppercase">{unit}</span>
		{/if}
	</div>
</div>
