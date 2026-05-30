<script lang="ts">
	import type { Snippet } from 'svelte';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';

	interface BackAction {
		label: string;
		onBack: () => void;
	}

	interface Props {
		title: string;
		right?: Snippet;
		back?: BackAction;
		children: Snippet;
	}

	const { title, right, back, children }: Props = $props();
</script>

<MobileAppBar align="left" {back} {right} {title} />

<div class="hidden min-[56rem]:block">
	<SectionHeader {right} {title} />
</div>

{@render children()}
