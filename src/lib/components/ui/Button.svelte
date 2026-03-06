<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		disabled?: boolean | undefined;
		children: Snippet;
		onclick: () => void;
	}

	const { disabled = undefined, children, onclick }: Props = $props();
</script>

<button
	class="bg-primary text-primary-foreground inline-flex items-center justify-center gap-2 rounded-lg px-8 py-2.5 text-sm font-bold shadow-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
	{disabled}
	{onclick}
>
	{@render children()}
</button>
