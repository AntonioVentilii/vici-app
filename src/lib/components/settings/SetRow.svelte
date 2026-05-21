<script lang="ts">
	import type { Icon as LucideIcon } from 'lucide-svelte';
	import { ChevronRight } from 'lucide-svelte/icons';
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		sub?: string;
		icon?: typeof LucideIcon;
		badge?: string;
		muted?: boolean;
		onclick?: () => void;
		right?: Snippet;
	}

	const {
		label,
		sub = undefined,
		icon: IconComponent = undefined,
		badge = undefined,
		muted = false,
		onclick = undefined,
		right = undefined
	}: Props = $props();
</script>

<button class="set-row" class:is-muted={muted} {onclick} type="button">
	{#if IconComponent}
		<span class="set-row-icon" aria-hidden="true">
			<IconComponent size={18} strokeWidth={1.6} />
		</span>
	{/if}
	<span class="set-row-copy">
		<span class="set-row-label">{label}</span>
		{#if sub}
			<span class="set-row-sub">{sub}</span>
		{/if}
	</span>
	{#if badge}
		<span class="set-row-badge">{badge}</span>
	{/if}
	{#if right}
		{@render right()}
	{:else}
		<ChevronRight class="set-row-chevron" aria-hidden="true" size={16} strokeWidth={1.6} />
	{/if}
</button>

<style lang="postcss">
	.set-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.875rem;
		border: none;
		background: var(--bg-surface);
		color: var(--text-base);
		text-align: left;
		cursor: pointer;
		transition: background-color var(--d-hover) var(--ease-vici);
	}

	.set-row:hover {
		background: var(--bg-popover);
	}

	.set-row.is-muted {
		color: var(--text-muted);
	}

	.set-row-icon {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: var(--r-8);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		color: var(--color-primary);
	}

	.set-row.is-muted .set-row-icon {
		background: color-mix(in srgb, var(--text-base) 7%, transparent);
		color: var(--text-muted);
	}

	.set-row-copy {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.set-row-label {
		font-size: var(--t-14);
		font-weight: 600;
	}

	.set-row-sub {
		font-size: 0.6875rem;
		color: var(--text-muted);
	}

	.set-row-badge {
		flex-shrink: 0;
		padding: 0.125rem 0.375rem;
		border-radius: var(--r-pill);
		font-size: 0.625rem;
		font-weight: 600;
		background: var(--laurel-glow);
		color: var(--color-primary);
	}

	:global(.set-row-chevron) {
		flex-shrink: 0;
		color: var(--text-muted);
	}
</style>
