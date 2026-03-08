<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fly } from 'svelte/transition';
	import { clickOutside } from '$lib/actions/click-outside';

	interface Props {
		open: boolean;
		onClose?: () => void;
		trigger: Snippet;
		content: Snippet;
		align?: 'left' | 'right';
	}

	let { open = $bindable(), onClose, trigger, content, align = 'right' }: Props = $props();

	const toggle = () => {
		open = !open;
	};

	const handleClose = () => {
		if (open) {
			open = false;
			onClose?.();
		}
	};
</script>

<div class="relative inline-block text-left" use:clickOutside={handleClose}>
	<div onclick={toggle} onkeydown={(e) => e.key === 'Enter' && toggle()} role="button" tabindex="0">
		{@render trigger()}
	</div>

	{#if open}
		<div
			class="absolute {align === 'right'
				? 'right-0'
				: 'left-0'} ring-opacity-5 z-50 mt-2 min-w-48 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black focus:outline-none"
			transition:fly={{ y: 8, duration: 200 }}
		>
			{@render content()}
		</div>
	{/if}
</div>
