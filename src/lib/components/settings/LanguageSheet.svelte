<script lang="ts">
	import { Check, Search, X } from 'lucide-svelte/icons';
	import { browser } from '$app/environment';
	import { SUPPORTED_LOCALES, type AppLocale } from '$lib/constants/locale.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { createFocusTrap, type FocusTrap } from '$lib/utils/focus-trap.utils';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Searchable language picker rendered as an in-frame sheet (docked
	 * to the bottom of the Settings surface, anchored to its positioned
	 * parent rather than the viewport). Mirrors the bottom-sheet chrome
	 * — scrim, grip, slide-up — but stays inside the app column so it
	 * reads as part of the settings card stack.
	 *
	 * The list filters across each locale's native label and short code
	 * (accent-folded), keeps the active locale pinned to the top while
	 * no query is entered, and exposes real `option`/`listbox` roles for
	 * assistive tech. Picking a locale writes through `localeStore` and
	 * closes the sheet.
	 */
	interface Props {
		isOpen: boolean;
		current: AppLocale;
		onClose: () => void;
		onPick: (locale: AppLocale) => void;
	}

	const { isOpen, current, onClose, onPick }: Props = $props();

	let sheetEl = $state<HTMLDivElement | undefined>();
	let query = $state('');
	let trap: FocusTrap | null = null;

	// Accent-folded lower-case normaliser so a search for "espanol"
	// still matches "Español".
	const norm = (value: string): string => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

	const ordered = $derived.by(() => {
		const trimmed = norm(query.trim());

		const filtered =
			trimmed.length === 0
				? [...SUPPORTED_LOCALES]
				: SUPPORTED_LOCALES.filter(
						(locale) =>
							norm(locale.label).includes(trimmed) ||
							norm(locale.short).includes(trimmed) ||
							norm(locale.id).includes(trimmed)
					);

		// Pin the active locale to the top when not actively searching.
		if (trimmed.length > 0) {
			return filtered;
		}

		return [...filtered].sort((a, b) => (a.id === current ? -1 : b.id === current ? 1 : 0));
	});

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
			// Reset the query each time the sheet opens so it never
			// re-opens pre-filtered from a previous session.
			query = '';
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
				<h2 class="lang-title">{t({ locale: $localeStore, key: 'settings.language' })}</h2>
				<button
					class="lang-close"
					aria-label={t({ locale: $localeStore, key: 'a11y.close_modal' })}
					onclick={close}
					type="button"
				>
					<X aria-hidden="true" size={18} strokeWidth={1.8} />
				</button>
			</div>

			<div class="lang-search">
				<span class="lang-search-icon" aria-hidden="true">
					<Search size={15} strokeWidth={1.7} />
				</span>
				<input
					class="lang-search-input"
					aria-label={t({ locale: $localeStore, key: 'settings.language.search' })}
					placeholder={t({ locale: $localeStore, key: 'settings.language.search' })}
					type="text"
					bind:value={query}
				/>
			</div>

			<div
				class="lang-list"
				aria-label={t({ locale: $localeStore, key: 'settings.language' })}
				role="listbox"
			>
				{#if ordered.length === 0}
					<p class="lang-empty num">
						{t({ locale: $localeStore, key: 'settings.language.no_match' })}
					</p>
				{:else}
					{#each ordered as locale (locale.id)}
						{@const active = locale.id === current}
						<button
							class="lang-option"
							class:is-active={active}
							aria-selected={active}
							onclick={() => onPick(locale.id)}
							role="option"
							type="button"
						>
							<span class="lang-short num" class:is-active={active}>{locale.short}</span>
							<span class="lang-label">{locale.label}</span>
							{#if active}
								<Check class="lang-check" aria-hidden="true" size={16} strokeWidth={2} />
							{/if}
						</button>
					{/each}
				{/if}
			</div>
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
	   content column (`max-width: 28rem`, widening to the desktop
	   reading column) so the picker docks within the app frame rather
	   than spanning the full desktop viewport. The pill-nav is hidden
	   while the sheet is open so the docked panel owns the bottom slot. */
	.lang-scrim {
		position: fixed;
		inset: 0;
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
		padding: 0.5rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
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
		margin-bottom: 0.5rem;
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

	.lang-search {
		position: relative;
		margin-bottom: 0.5rem;
	}

	.lang-search-icon {
		position: absolute;
		top: 50%;
		left: 0.7rem;
		display: inline-flex;
		color: var(--text-muted);
		pointer-events: none;
		transform: translateY(-50%);
	}

	.lang-search-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.6rem 0.75rem 0.6rem 2.1rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--r-8);
		background: var(--bg-surface);
		color: var(--text-base);
		font-family: var(--font-sans);
		font-size: var(--t-13);
		outline: none;
	}

	.lang-search-input:focus-visible {
		border-color: var(--color-primary);
	}

	.lang-list {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.lang-empty {
		padding: 1.25rem 0;
		font-size: var(--t-12);
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		text-align: center;
		color: var(--text-muted);
	}

	.lang-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.6rem 0.65rem;
		border: none;
		border-radius: var(--r-8);
		background: transparent;
		color: var(--text-base);
		text-align: left;
		cursor: pointer;
		transition: background-color var(--d-hover) var(--ease-vici);
	}

	.lang-option:hover {
		background: var(--bg-surface);
	}

	.lang-option.is-active {
		background: var(--bg-surface);
	}

	.lang-short {
		flex-shrink: 0;
		width: 1.85rem;
		font-size: var(--t-10);
		font-weight: 700;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}

	.lang-short.is-active {
		color: var(--color-primary);
	}

	.lang-label {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		font-size: var(--t-14);
		font-weight: 500;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.lang-option.is-active .lang-label {
		font-weight: 600;
	}

	:global(.lang-check) {
		flex-shrink: 0;
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
