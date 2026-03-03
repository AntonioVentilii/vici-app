<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		class?: string;
	}

	const { children, class: className = '' }: Props = $props();
</script>

<div class="border-border bg-card text-card-foreground rounded-lg border shadow-sm {className}">
	{@render children()}
</div>
