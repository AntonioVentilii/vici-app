<script lang="ts">
	import { cn } from '@/lib/utils';
	export let className: string = '';
	export let value: string = '';
	export let placeholder: string = '';
</script>

<input
	class={cn(
		'border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
	{placeholder}
	bind:value
	on:input
	{...$$restProps}
/>
