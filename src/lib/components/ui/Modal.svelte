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

	const handleKeyDown = (event: KeyboardEvent) => {
		if (isOpen && event.key === 'Escape') {
			close();
		}
	};
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
		role="presentation"
	>
		<BaseButton
			class="fixed inset-0 bg-slate-950/40! opacity-100!"
			aria-label="Close modal"
			onclick={close}
		>
			<span class="sr-only">Close</span>
		</BaseButton>

		<div
			class="animate-in fade-in zoom-in wrapper relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl duration-200"
			aria-modal="true"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
		>
			<div class="header flex justify-end p-4 pb-0">
				<button
					class="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100"
					aria-label="Close"
					onclick={close}
					type="button"
				>
					<svg
						class="lucide lucide-x"
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
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				</button>
			</div>

			<div class="content flex-1 overflow-y-auto p-8 pt-4">
				{@render children()}
			</div>
		</div>
	</div>
{/if}

<style>
	:global(body:has(.wrapper)) {
		overflow: hidden;
	}

	.wrapper {
		max-height: 90vh;
	}

	@supports (-webkit-touch-callout: none) {
		.wrapper {
			max-height: -webkit-fill-available;
		}
	}
</style>
