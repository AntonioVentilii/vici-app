<script lang="ts">
	import { cn } from '../../lib/utils';

	export let checked: boolean = false;
	export let className: string = '';
	export let disabled: boolean = false;
	export let id: string = '';
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	{disabled}
	{id}
	class={cn(
		'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
		checked ? 'bg-slate-900' : 'bg-slate-200',
		className
	)}
	on:click={() => {
		if (!disabled) checked = !checked;
	}}
	{...$$restProps}
>
	<span
		class={cn(
			'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
			checked ? 'translate-x-5' : 'translate-x-0'
		)}
	/>
</button>
