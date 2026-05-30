<script lang="ts">
	import type { Snippet } from 'svelte';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';

	/**
	 * Shared chrome for **top-level** pages (Markets / Dash / Arena /
	 * Profile): a left-aligned title with an optional top-right action,
	 * rendered as a `MobileAppBar` on mobile and a `SectionHeader` at
	 * `≥56rem`. The bottom nav (`MobileNav`) is mounted globally and is
	 * not part of this scaffold.
	 *
	 * Deliberately no `back` affordance: top-level nav pages don't have
	 * one, and `SectionHeader` renders no back control at desktop widths,
	 * so a scaffold-level `back` would silently vanish on desktop. Pages
	 * that genuinely need back navigation (detail / settings surfaces)
	 * use `MobileAppBar` directly with its `back` prop.
	 */
	interface Props {
		title: string;
		right?: Snippet;
		children: Snippet;
	}

	const { title, right, children }: Props = $props();
</script>

<MobileAppBar align="left" {right} {title} />

<div class="hidden min-[56rem]:block">
	<SectionHeader {right} {title} />
</div>

{@render children()}
