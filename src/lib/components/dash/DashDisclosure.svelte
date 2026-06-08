<script lang="ts">
	/**
	 * Collapsible foldout used for the standard dashboard's secondary
	 * insights (rival, contrarian wins, untried category). Carries the
	 * shared summary + chevron + body scaffold so each call site only
	 * supplies its title and body content. Class names live in `app.css`.
	 */
	import { ChevronRight } from '@lucide/svelte/icons';
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		body: Snippet;
	}

	let { title, body }: Props = $props();
</script>

<details class="dash-disclosure">
	<summary>
		<span>{title}</span>
		<ChevronRight aria-hidden="true" size={12} strokeWidth={1.8} />
	</summary>
	<div class="dash-disclosure-body">
		{@render body()}
	</div>
</details>
