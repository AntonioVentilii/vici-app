<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		message: string;
		children?: Snippet;
	}

	const { message, children }: Props = $props();
</script>

<div class="flex w-full flex-col items-center space-y-4 py-20 text-center">
	<div
		class="bg-foreground/6 text-muted-foreground mx-auto flex h-16 w-16 items-center justify-center rounded-full"
	>
		<svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
			/>
		</svg>
	</div>
	<p class="text-muted-foreground font-medium">{message}</p>
	{#if children}
		<div class="mt-4">
			{@render children()}
		</div>
	{/if}
</div>
