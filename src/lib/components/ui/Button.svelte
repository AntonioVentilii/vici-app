<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		disabled?: boolean | undefined;
		children: Snippet;
		onclick: () => Promise<void>;
	}

	const { disabled = undefined, children, onclick }: Props = $props();
</script>

<button
	class="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
	{disabled}
	{onclick}
>
	{@render children()}
</button>
