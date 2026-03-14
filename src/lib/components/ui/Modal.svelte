<script lang="ts">
	import type { Snippet } from 'svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';

	interface Props {
		isOpen: boolean;
		children: Snippet;
		onClose: () => void;
	}

	const { isOpen, children, onClose }: Props = $props();

	const close = () => {
		onClose();
	};
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
		<BaseButton
			class="fixed inset-0 bg-slate-950/40! opacity-100!"
			aria-label="Close modal"
			onclick={close}
		>
			<span class="sr-only">Close</span>
		</BaseButton>

		<div
			class="animate-in fade-in zoom-in relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl duration-200"
		>
			{@render children()}
		</div>
	</div>
{/if}
