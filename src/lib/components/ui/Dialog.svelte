<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import { X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

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
	class="bg-popover border-border-strong shadow-modal fixed inset-0 z-50 m-auto min-h-50 w-full max-w-lg overflow-hidden rounded-[12px] border p-0 backdrop:bg-black/55 backdrop:backdrop-blur-[8px]"
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
				aria-label={t({ locale: $localeStore, key: 'a11y.close_dialog' })}
				onclick={close}
			>
				<X size={24} />
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
