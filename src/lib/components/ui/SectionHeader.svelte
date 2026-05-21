<script lang="ts">
	interface Props {
		title: string;
		highlight?: string;
		description?: string;
	}

	const { title, highlight, description }: Props = $props();
</script>

<div class="space-y-2">
	<h1 class="text-foreground text-3xl leading-tight tracking-tight sm:text-4xl">
		<span class="serif-italic">{title}</span>{#if highlight}<span
				class="text-primary font-display font-bold">{highlight}</span
			>{/if}
	</h1>
	{#if description}
		<p class="text-muted-foreground max-w-2xl text-sm leading-relaxed text-pretty">
			{description}
		</p>
	{/if}
</div>
