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
		class="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-[8px]"
		role="presentation"
	>
		<BaseButton
			class="fixed inset-0 bg-black/55! opacity-100!"
			aria-label="Close modal"
			onclick={close}
		>
			<span class="sr-only">Close</span>
		</BaseButton>

		<div
			class="animate-in fade-in zoom-in wrapper bg-popover border-border-strong shadow-modal relative flex w-full max-w-md flex-col overflow-hidden rounded-[12px] border duration-200"
			aria-modal="true"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
		>
			<div class="header relative flex items-center justify-between gap-4 p-4 pb-0">
				<div class="flex flex-1 items-center justify-end gap-2">
					<button
						class="text-muted-foreground hover:bg-foreground/6 hover:text-foreground rounded-full p-2 transition-colors"
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
			</div>

			<div class="content text-foreground flex-1 overflow-y-auto p-8 pt-4">
				{@render children()}
			</div>
		</div>
	</div>
{/if}

<style lang="postcss">
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
