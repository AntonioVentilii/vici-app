<script lang="ts">
	import { goto } from '$app/navigation';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import { AppPath } from '$lib/constants/routes.constants';

	interface Props {
		/** When set, render a link (for public landing) instead of the in-app home button. */
		href?: string;
	}

	const { href }: Props = $props();

	const handleNav = (path: AppPath) => {
		goto(path);
	};

	// Brand-book wordmark: Hanken Grotesk Bold, ALL CAPS, 0.18em tracking.
	// Type-set live in product (no SVG) per brand-book/logo-assets/README.md.
	const wordmarkClass =
		'text-primary inline-block leading-none uppercase font-bold text-[1.25rem] tracking-[0.18em] transition-[filter] duration-200 group-hover:[filter:drop-shadow(0_0_12px_var(--laurel-glow))]';
</script>

{#snippet wordmark()}
	<span style="font-family: var(--font-display);" class={wordmarkClass} aria-hidden="true">
		VICI
	</span>
{/snippet}

{#if href}
	<a class="group inline-flex items-center" aria-label="VICI" {href}>
		{@render wordmark()}
	</a>
{:else}
	<BaseButton
		class="group flex items-center"
		aria-label="VICI — go to home"
		onclick={() => handleNav(AppPath.Home)}
	>
		{@render wordmark()}
	</BaseButton>
{/if}
