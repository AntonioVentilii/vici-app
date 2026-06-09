<script lang="ts">
	import { Globe, X } from '@lucide/svelte/icons';
	import { browser } from '$app/environment';
	import { pinToVisualViewport } from '$lib/actions/pin-to-visual-viewport';
	import LocalePicker from '$lib/components/ui/LocalePicker.svelte';
	import { LOCALE_REGISTRY, type AppLocale } from '$lib/constants/locale.constants';
	import {
		clearLocaleChoice,
		detectedLocale,
		localeChoiceExplicit,
		localeStore
	} from '$lib/stores/locale.store';
	import { createFocusTrap, type FocusTrap } from '$lib/utils/focus-trap.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Two-axis (Language ▸ Region) locale picker rendered as a bottom sheet
	 * docked to the bottom of the viewport. Owns the bottom-sheet chrome —
	 * scrim, grip, slide-up, focus trap, viewport pinning — and hosts the
	 * shared `LocalePicker`. A "Use automatic" footer appears only when the
	 * active locale is an explicit choice. Used by the Settings surface and the
	 * landing nav (mobile), which pass their own `titleKey`.
	 */
	interface Props {
		isOpen: boolean;
		current: AppLocale;
		onClose: () => void;
		onPick: (locale: AppLocale) => void;
		/** Catalog key for the sheet header (e.g. settings vs. landing). */
		titleKey?: MessageKey;
	}

	const { isOpen, current, onClose, onPick, titleKey = 'settings.language' }: Props = $props();

	let sheetEl = $state<HTMLDivElement | undefined>();
	let trap: FocusTrap | null = null;

	// Region the "Use automatic" reset would fall back to, for its sub-label.
	const detectedRegionLabel = $derived(
		LOCALE_REGISTRY.find(({ id }) => id === detectedLocale)?.regionLabel ?? null
	);

	const close = () => {
		onClose();
	};

	const useAutomatic = () => {
		clearLocaleChoice();
		close();
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
		class="lang-scrim"
		aria-label={t({ locale: $localeStore, key: 'a11y.close_modal' })}
		onclick={close}
		onkeydown={(e) => e.key === 'Escape' && close()}
		role="presentation"
		use:pinToVisualViewport
	>
		<div
			bind:this={sheetEl}
			class="lang-sheet"
			aria-modal="true"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					e.stopPropagation();
					close();
				}
			}}
			role="dialog"
			tabindex="-1"
		>
			<div class="lang-grip" aria-hidden="true"></div>

			<div class="lang-head">
				<h2 class="lang-title">{t({ locale: $localeStore, key: titleKey })}</h2>
				<button
					class="lang-close"
					aria-label={t({ locale: $localeStore, key: 'a11y.close_modal' })}
					onclick={close}
					type="button"
				>
					<X aria-hidden="true" size={18} strokeWidth={1.8} />
				</button>
			</div>

			<LocalePicker {current} maxHeight={420} {onPick} />

			{#if $localeChoiceExplicit}
				<button class="lang-auto" onclick={useAutomatic} type="button">
					<Globe aria-hidden="true" size={15} strokeWidth={1.8} />
					<span>
						{t({ locale: $localeStore, key: 'picker.use_auto' })}{detectedRegionLabel
							? ` · ${detectedRegionLabel}`
							: ''}
					</span>
				</button>
			{/if}
		</div>
	</div>
{/if}

<style lang="postcss">
	/* Lock body scroll + hide the floating pill-nav while the sheet is
	   open — the nav sits at the same bottom edge and would clip the
	   panel's actions, and it isn't usable from inside a modal flow. */
	:global(body:has(.lang-sheet)) {
		overflow: hidden;
	}

	:global(body:has(.lang-sheet) .pillnav-wrap) {
		display: none;
	}

	/* In-frame scrim — pinned to the bottom and constrained to the app
	   content column so the picker docks within the app frame rather than
	   spanning the full desktop viewport. */
	.lang-scrim {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 100vh; /* fallback for engines without `dvh` / visualViewport */
		height: 100dvh;
		z-index: 80;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		background: rgba(14, 13, 11, 0.55);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		animation: lang-scrim-in var(--d-state) ease-out both;
	}

	.lang-sheet {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 28rem;
		max-height: 86%;
		padding: 0.5rem 0.5rem
			calc(1rem + env(safe-area-inset-bottom, 0px) + var(--ios-chrome-toolbar-inset, 0px));
		background: var(--bg-popover);
		border-top: 1px solid var(--border-strong);
		border-top-left-radius: 28px;
		border-top-right-radius: 28px;
		box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.4);
		animation: lang-sheet-up 320ms var(--ease-vici) both;
	}

	@media (prefers-reduced-motion: reduce) {
		.lang-scrim,
		.lang-sheet {
			animation: none;
		}
	}

	.lang-grip {
		align-self: center;
		width: 40px;
		height: 4px;
		margin: 0.25rem 0 0.85rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-muted) 50%, transparent);
	}

	.lang-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin: 0 0.75rem 0.5rem;
	}

	.lang-title {
		margin: 0;
		font-size: var(--t-16);
		font-weight: 600;
		letter-spacing: var(--tracking-snug);
		color: var(--text-base);
	}

	.lang-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.375rem;
		border: none;
		border-radius: var(--r-8);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: color var(--d-hover) var(--ease-vici);
	}

	.lang-close:hover {
		color: var(--text-base);
	}

	/* "Use automatic" reset — a full-width footer above the safe-area
	   inset, separated from the list by a hairline. */
	.lang-auto {
		display: flex;
		align-items: center;
		gap: 0.5625rem;
		width: 100%;
		box-sizing: border-box;
		margin-top: 0.25rem;
		padding: 0.8125rem 1rem;
		border: 0;
		border-top: 1px solid var(--border-base);
		background: transparent;
		color: var(--text-muted);
		text-align: left;
		font-family: var(--font-sans);
		font-size: var(--t-13);
		font-weight: 500;
		cursor: pointer;
		transition: color var(--d-hover) var(--ease-vici);
	}

	.lang-auto:hover {
		color: var(--color-primary);
	}

	@keyframes lang-scrim-in {
		from {
			opacity: 0;
		}
	}

	@keyframes lang-sheet-up {
		from {
			transform: translateY(100%);
		}
	}
</style>
