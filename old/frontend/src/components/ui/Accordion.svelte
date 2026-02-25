<script lang="ts">
	import { slide } from 'svelte/transition';
	import { ChevronDown } from 'lucide-svelte';

	export let title: string;
	let isOpen = false;
</script>

<div class="border-border border-b last:border-0">
	<button
		class="flex w-full items-center justify-between py-4 text-left font-medium transition-all hover:underline"
		on:click={() => (isOpen = !isOpen)}
	>
		{title}
		<ChevronDown
			class="h-4 w-4 shrink-0 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}"
		/>
	</button>
	{#if isOpen}
		<div transition:slide={{ duration: 200 }} class="text-muted-foreground pb-4 text-sm">
			<slot />
		</div>
	{/if}
</div>
