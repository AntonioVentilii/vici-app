<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte/icons';
	import type { Snippet } from 'svelte';

	interface BackAction {
		label: string;
		onBack: () => void;
	}

	interface Props {
		title?: string;
		titleChildren?: Snippet;
		back?: BackAction;
		right?: Snippet;
		align?: 'left' | 'center';
	}

	const { title, titleChildren, back, right, align }: Props = $props();

	const resolvedAlign = $derived(align ?? (back !== undefined ? 'center' : 'left'));

	const handleBack = () => {
		back?.onBack();
	};
</script>

<header class="mobile-appbar" data-align={resolvedAlign}>
	{#if back}
		<button class="appbar-icon-btn" aria-label={back.label} onclick={handleBack} type="button">
			<ArrowLeft aria-hidden="true" size={18} strokeWidth={1.8} />
		</button>
	{:else}
		<span class="mobile-appbar-spacer" aria-hidden="true"></span>
	{/if}

	<div class="mobile-appbar-title-slot">
		{#if titleChildren}
			{@render titleChildren()}
		{:else if title}
			<h1 class="mobile-appbar-title">{title}</h1>
		{/if}
	</div>

	<div class="mobile-appbar-right">
		{#if right}
			{@render right()}
		{:else}
			<span class="mobile-appbar-spacer" aria-hidden="true"></span>
		{/if}
	</div>
</header>

<style lang="postcss">
	.mobile-appbar {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.25rem 0.5rem;
	}

	@media (min-width: 768px) {
		.mobile-appbar {
			display: none;
		}
	}

	.mobile-appbar[data-align='left'] {
		grid-template-columns: minmax(0, 1fr) auto;
	}

	.mobile-appbar[data-align='left'] :global(.mobile-appbar-spacer:first-child) {
		display: none;
	}

	/* Width matches the `.appbar-icon-btn` outer footprint (18px icon
	   + padding 8/10 + 1px border = 40w × 36h) so the title remains
	   visually centered when only one side has a control. */
	.mobile-appbar-spacer {
		display: inline-block;
		width: 2.5rem;
		height: 2.25rem;
	}

	.mobile-appbar-title-slot {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.5rem;
	}

	.mobile-appbar[data-align='center'] .mobile-appbar-title-slot {
		justify-content: center;
	}

	.mobile-appbar-title {
		margin: 0;
		overflow: hidden;
		color: var(--text-base);
		font-size: var(--t-24);
		font-weight: 700;
		letter-spacing: var(--tracking-tight);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mobile-appbar[data-align='center'] .mobile-appbar-title {
		font-size: var(--t-18);
		font-weight: 600;
	}

	.mobile-appbar-right {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.375rem;
	}
</style>
