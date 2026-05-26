<script lang="ts">
	import { ChevronRight, Plus } from 'lucide-svelte/icons';

	/**
	 * Trailing "Create a league" / "Join with code" CTA card
	 * rendered at the end of the Leagues list. Matches the
	 * row shape of `LeagueListCard` so both surfaces feel
	 * continuous, with the gradient tile reserved for an icon
	 * or short glyph string instead of a league emblem.
	 */
	interface Props {
		title: string;
		sub: string;
		variant: 'create' | 'join';
		onclick: () => void;
	}

	const { title, sub, variant, onclick }: Props = $props();
</script>

<button class="league-cta-card" {onclick} type="button">
	<span class="league-cta-logo" aria-hidden="true">
		{#if variant === 'create'}
			<Plus aria-hidden="true" size={18} strokeWidth={2} />
		{:else}
			<span class="join-glyph">JOIN</span>
		{/if}
	</span>

	<span class="body">
		<span class="title">{title}</span>
		<span class="sub num">{sub}</span>
	</span>

	<ChevronRight aria-hidden="true" size={16} strokeWidth={1.6} />
</button>

<style lang="postcss">
	.league-cta-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.85rem 0.95rem;
		font: inherit;
		text-align: left;
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 88%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici);
	}

	.league-cta-card:hover {
		background: color-mix(in srgb, var(--bg-surface) 70%, transparent);
		border-color: var(--border-strong);
	}

	.league-cta-logo {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 2.5rem;
		height: 2.5rem;
		color: var(--color-primary);
		background: color-mix(in srgb, var(--bg-surface) 60%, transparent);
		border: 1px dashed color-mix(in srgb, var(--color-primary) 45%, var(--border-base));
		border-radius: var(--r-8);
	}

	.join-glyph {
		font-family: var(--font-mono, monospace);
		font-size: var(--t-11, 0.7rem);
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--color-primary);
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		flex: 1;
		min-width: 0;
	}

	.title {
		font-family: var(--font-display);
		font-size: var(--t-15, 0.9375rem);
		font-weight: 600;
		color: var(--text-base);
	}

	.sub {
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
		letter-spacing: 0.04em;
	}
</style>
