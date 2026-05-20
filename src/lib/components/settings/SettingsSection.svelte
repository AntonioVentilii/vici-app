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
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--parchment-mute);
	}

	.settings-section-panel {
		display: flex;
		flex-direction: column;
		gap: 1px;
		overflow: hidden;
		border-radius: var(--r-12);
		border: 1px solid var(--border-base);
		background: var(--bg-raised);
	}
</style>
