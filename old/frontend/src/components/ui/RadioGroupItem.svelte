<script lang="ts">
	import { getContext } from 'svelte';
	import { radioGroupContext } from './RadioGroup.svelte';
	import { cn } from '../../lib/utils';

	export let value: string;
	export let id: string = '';
	export let className: string = '';
	export let disabled: boolean = false;

	const { valueStore, setValue } = getContext(radioGroupContext) as any;
	$: isSelected = $valueStore === value;
</script>

<button
	type="button"
	role="radio"
	aria-checked={isSelected}
	{id}
	{disabled}
	class={cn(
		'aspect-square h-4 w-4 rounded-full border border-slate-900 text-slate-900 ring-offset-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
		isSelected && 'bg-slate-900',
		className
	)}
	on:click={() => {
		if (!disabled) setValue(value);
	}}
>
	{#if isSelected}
		<span class="flex items-center justify-center text-current">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="white"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="h-2.5 w-2.5"
			>
				<circle cx="12" cy="12" r="10" fill="currentColor" />
			</svg>
		</span>
	{/if}
</button>
