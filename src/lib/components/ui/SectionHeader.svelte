<script lang="ts">
	interface Props {
		title: string;
		highlight?: string;
		description?: string;
	}

	const { title, highlight, description }: Props = $props();
</script>

<div class="space-y-2">
	<h1 class="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
		{title}
		{#if highlight}<span class="text-indigo-600">{highlight}</span>{/if}
	</h1>
	{#if description}
		<p class="max-w-2xl text-base text-slate-600">
			{description}
		</p>
	{/if}
</div>
