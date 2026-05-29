<script lang="ts">
	import type { Snippet } from 'svelte';
	import { browser } from '$app/environment';
	import { localeStore } from '$lib/stores/locale.store';
	import { createFocusTrap, type FocusTrap } from '$lib/utils/focus-trap.utils';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Bottom-sheet primitive — full-width sheet docked at the bottom of
	 * the viewport with a grip handle, blurred backdrop, and safe-area
	 * inset. Used by the leagues / worlds / bouts surfaces in place of
	 * the centred {@link Modal} when a sheet treatment fits better.
	 *
	 * The component manages chrome only (scrim, grip, close affordance
	 * via `Escape` + backdrop click). Children own their own header
	 * copy + body layout — keep them short enough that the sheet doesn't
	 * exceed `max-height: 92vh`.
	 *
	 * Custom (non-native-dialog) sheet, so focus management is manual:
	 * `createFocusTrap` moves initial focus into the sheet on open,
	 * cycles Tab/Shift+Tab inside, and returns focus to the trigger on
	 * close. Native `<dialog>` users (see `Dialog.svelte`) get the same
	 * behaviour from the browser.
	 */
	interface Props {
		isOpen: boolean;
		children: Snippet;
		onClose: () => void;
	}

	const { isOpen, children, onClose }: Props = $props();

	let sheetEl = $state<HTMLDivElement | undefined>();
	let trap: FocusTrap | null = null;

	const close = () => {
		onClose();
	};

	const handleKeyDown = (event: KeyboardEvent) => {
		if (isOpen && event.key === 'Escape') {
			close();
		}
	};

	$effect(() => {
		if (!browser) {
			return;
		}

		if (isOpen && sheetEl) {
			trap = createFocusTrap(sheetEl);
			trap.activate();
		} else if (trap) {
			trap.deactivate();
			trap = null;
		}

		return () => {
			if (trap) {
				trap.deactivate();
				trap = null;
			}
		};
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if isOpen}
	<div
		class="sheet-scrim"
		aria-label={t({ locale: $localeStore, key: 'a11y.close_modal' })}
		onclick={close}
		onkeydown={(e) => e.key === 'Escape' && close()}
		role="presentation"
	>
		<div
			bind:this={sheetEl}
			class="sheet"
			aria-modal="true"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
		>
			<div class="sheet-grip" aria-hidden="true"></div>
			<div class="sheet-body">
				{@render children()}
			</div>
		</div>
	</div>
{/if}

<style lang="postcss">
	:global(body:has(.sheet)) {
		overflow: hidden;
	}

	/* Hide the floating mobile pill-nav (`.pillnav-wrap`, fixed bottom,
	 * z-index 50) whenever a sheet is open. It sits at the same lower
	 * edge as the sheet and clips the actions row on short viewports
	 * (e.g. with the soft keyboard open) — and isn't usable from inside
	 * a modal flow anyway. */
	:global(body:has(.sheet) .pillnav-wrap) {
		display: none;
	}

	.sheet-scrim {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		background: rgba(14, 13, 11, 0.62);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		animation: friend-sheet-fade-in 200ms ease-out both;
	}

	.sheet {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 32rem;
		max-height: 92vh;
		padding: 0.5rem 1.1rem calc(1.1rem + env(safe-area-inset-bottom, 0px));
		background: var(--bg-popover);
		border-top: 1px solid var(--border-base);
		border-top-left-radius: 22px;
		border-top-right-radius: 22px;
		box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.4);
		animation: friend-sheet-slide-up 280ms var(--ease-vici) both;
	}

	@media (prefers-reduced-motion: reduce) {
		.sheet-scrim,
		.sheet {
			animation: none;
		}
	}

	.sheet-grip {
		align-self: center;
		width: 36px;
		height: 4px;
		margin: 0.25rem 0 0.7rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-muted) 50%, transparent);
	}

	.sheet-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
	}

	@keyframes sheet-rise {
		from {
			transform: translateY(16px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
</style>
