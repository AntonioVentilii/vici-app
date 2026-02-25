<script lang="ts">
	import { cn } from '../../lib/utils';

	export let value: string = '';
	export let placeholder: string = '';
	export let rows: number = 3;
	export let className: string = '';
	export let disabled: boolean = false;
	export let required: boolean = false;
</script>

<textarea
	bind:value
	{placeholder}
	{rows}
	{disabled}
	{required}
	class={cn(
		'flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
	{...$$restProps}
	on:input
	on:change
	on:keydown
	on:blur
	on:focus
></textarea>
