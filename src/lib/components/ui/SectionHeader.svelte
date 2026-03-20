<script lang="ts">
	interface Props {
		title: string;
		highlight?: string;
		description?: string;
	}

	const { title, highlight, description }: Props = $props();
</script>

<div class="space-y-2">
	<h1 class="text-foreground font-serif text-3xl font-extrabold tracking-tight sm:text-4xl">
		{title}
		{#if highlight}<span class="text-primary">{highlight}</span>{/if}
	</h1>
	{#if description}
		<p class="text-muted-foreground max-w-2xl text-base">
			{description}
		</p>
	{/if}
</div>
