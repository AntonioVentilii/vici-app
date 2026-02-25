<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		class?: string;
	}

	const { children, class: className = '' }: Props = $props();
</script>

<div class="rounded-3xl border border-slate-200 bg-white shadow-sm {className}">
	{@render children()}
</div>
