<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		children: Snippet;
	}

	const { title, children }: Props = $props();
</script>

<section class="settings-section">
	<h3 class="settings-section-title">{title}</h3>
	<div class="settings-section-panel">
		{@render children()}
	</div>
</section>

<style lang="postcss">
	.settings-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.settings-section-title {
		margin: 0;
		font-size: var(--t-11);
		font-weight: 600;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		color: var(--text-muted);
	}

	/* Rows are laid out with a 1px gap whose background is the hairline
	   border colour, so the gap renders as a full-bleed row separator
	   (matching the settings card's inter-row divider). The rows
	   themselves paint `--bg-surface`, leaving only the 1px seam
	   visible; no separator shows after the last row because the gap
	   sits between siblings only. */
	.settings-section-panel {
		display: flex;
		flex-direction: column;
		gap: 1px;
		overflow: hidden;
		border-radius: var(--r-12);
		border: 1px solid var(--border-base);
		background: var(--border-base);
		box-shadow: var(--shadow-card);
	}
</style>
