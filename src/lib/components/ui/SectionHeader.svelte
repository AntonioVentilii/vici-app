<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		/** Small uppercase line above the title (e.g. the featured-event name
		 *  on the WC-focused Markets header). */
		eyebrow?: string;
		highlight?: string;
		description?: string;
		right?: Snippet;
	}

	const { title, eyebrow, highlight, description, right }: Props = $props();
</script>

<div class="space-y-2">
	<div class="flex items-start justify-between gap-4">
		<div class="min-w-0">
			{#if eyebrow}
				<span class="text-muted-foreground mb-1 block text-xs font-semibold tracking-wide uppercase"
					>{eyebrow}</span
				>
			{/if}
			<h1 class="text-foreground text-3xl leading-tight tracking-tight sm:text-4xl">
				<span class="serif-italic">{title}</span>{#if highlight}<span
						class="text-primary font-display font-bold">{highlight}</span
					>{/if}
			</h1>
		</div>
		{#if right}
			<div class="shrink-0">{@render right()}</div>
		{/if}
	</div>
	{#if description}
		<p class="text-muted-foreground max-w-2xl text-sm leading-relaxed text-pretty">
			{description}
		</p>
	{/if}
</div>
