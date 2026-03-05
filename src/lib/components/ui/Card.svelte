<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		class?: string;
		glassStyle?: boolean;
	}

	const { children, class: className = '', glassStyle = false }: Props = $props();
</script>

<div
	class="border-border bg-card text-card-foreground rounded-lg border shadow-sm {className}"
	class:glassmorphism={glassStyle}
>
	{@render children()}
</div>

<style lang="postcss">
	.glassmorphism {
		background: rgba(255, 255, 255, 0.03);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.05);
	}
</style>
