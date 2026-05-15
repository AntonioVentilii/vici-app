<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';

	interface Props {
		show: boolean;
		title?: string;
		children: Snippet;
	}

	let { show = $bindable(false), title, children }: Props = $props();

	let dialog = $state<HTMLDialogElement | undefined>();

	$effect(() => {
		if (isNullish(dialog)) {
			return;
		}

		if (show && !dialog.open) {
			dialog.showModal();
			document.body.style.overflow = 'hidden';
		}

		if (!show && dialog.open) {
			dialog.close();
			document.body.style.overflow = '';
		}
	});

	const close = () => {
		show = false;
	};

	const handleClose = () => {
		show = false;
		document.body.style.overflow = '';
	};
</script>

<dialog
	bind:this={dialog}
	class="bg-popover fixed inset-0 z-50 m-auto min-h-50 w-full max-w-lg overflow-hidden rounded-[12px] border border-[var(--border-strong)] p-0 shadow-[var(--shadow-modal)] backdrop:bg-black/55 backdrop:backdrop-blur-[8px]"
	oncancel={close}
	onclose={handleClose}
>
	<div class="text-foreground flex min-h-50 flex-col p-6 sm:p-8" in:fade={{ duration: 200 }}>
		<div class="mb-6 flex items-center justify-between">
			{#if title}
				<h2 class="text-foreground text-2xl font-bold">{title}</h2>
			{/if}

			<button
				class="text-muted-foreground hover:bg-foreground/6 hover:text-foreground rounded-full p-2 transition-colors"
				aria-label="Close dialog"
				onclick={close}
			>
				<svg
					fill="none"
					height="24"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					viewBox="0 0 24 24"
					width="24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<line x1="18" x2="6" y1="6" y2="18"></line>
					<line x1="6" x2="18" y1="6" y2="18"></line>
				</svg>
			</button>
		</div>

		<div class="flex-1">
			{@render children()}
		</div>
	</div>
</dialog>

<style lang="postcss">
	dialog::backdrop {
		animation: fade-in 0.2s ease-out;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	dialog {
		animation: zoom-in 0.2s ease-out;
	}

	@keyframes zoom-in {
		from {
			transform: scale(0.95);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}
</style>
