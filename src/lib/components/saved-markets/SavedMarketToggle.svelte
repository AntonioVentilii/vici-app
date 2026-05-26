<script lang="ts">
	import { Heart } from 'lucide-svelte/icons';
	import { localeStore } from '$lib/stores/locale.store';
	import {
		isMarketSaved,
		preferencesStore,
		toggleSavedMarket
	} from '$lib/stores/preferences.store';
	import { t } from '$lib/utils/i18n.utils';

	type ToggleSize = 'sm' | 'md';

	interface Props {
		/** Market id to bookmark / unbookmark. */
		marketId: string;
		/** Visual size variant.
		 *
		 *  - `sm` (default) — compact 28×28 px circle, intended for inline
		 *    use in card headers (see `MarketCard`).
		 *  - `md` — 36×36 px pill, intended for prominent app-bar slots
		 *    (see `MarketDetailHeader`).
		 */
		size?: ToggleSize;
		/** Hard-stop the click from bubbling to a parent clickable surface
		 *  (e.g. a `<Card>` that navigates on click). Defaults to `true`
		 *  because both current call sites need it and forgetting is a
		 *  silent bug. */
		stopPropagation?: boolean;
	}

	const { marketId, size = 'sm', stopPropagation = true }: Props = $props();

	const saved = $derived(isMarketSaved({ marketId, prefs: $preferencesStore }));

	const onClick = (e: MouseEvent) => {
		if (stopPropagation) {
			e.stopPropagation();
		}

		toggleSavedMarket({ marketId });
	};

	const onKeydown = (e: KeyboardEvent) => {
		if (stopPropagation) {
			e.stopPropagation();
		}
	};
</script>

<!-- Shared heart-toggle primitive used by MarketCard, MarketDetailHeader,
     and any future surface that wants the same "bookmark this market"
     affordance. Visual state (saved → laurel pill, unsaved → muted
     outline) and label / aria are owned here so the two call sites
     can't drift on copy or treatment. -->
<button
	class={['saved-market-toggle', `size-${size}`, saved && 'is-saved']}
	aria-label={t({ locale: $localeStore, key: saved ? 'card.unsave' : 'card.save' })}
	aria-pressed={saved}
	onclick={onClick}
	onkeydown={onKeydown}
	type="button"
>
	<span class="saved-market-icon">
		<Heart
			aria-hidden="true"
			fill={saved ? 'currentColor' : 'none'}
			size={size === 'md' ? 16 : 14}
			strokeWidth={2}
		/>
	</span>
</button>

<style lang="postcss">
	.saved-market-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		color: color-mix(in srgb, var(--text-muted) 80%, transparent);
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici),
			color var(--d-hover) var(--ease-vici);
	}

	.saved-market-toggle:hover {
		border-color: color-mix(in srgb, var(--laurel) 40%, transparent);
		color: var(--laurel);
	}

	.saved-market-toggle.is-saved {
		border-color: color-mix(in srgb, var(--laurel) 40%, transparent);
		background: var(--laurel-glow);
		color: var(--laurel);
	}

	.size-sm {
		width: 1.75rem;
		height: 1.75rem;
	}

	.size-md {
		width: 2.25rem;
		height: 2.25rem;
		background: color-mix(in srgb, var(--bg-surface) 84%, transparent);
		color: var(--text-muted);
	}

	/* Heart-pop envelope on save toggle — visual punch that
	   substitutes for the haptic on iOS Safari (Vibration API
	   absent there). Mirrors prototype `app.css:486-490`. */
	.saved-market-icon {
		display: inline-flex;
	}
	.saved-market-toggle.is-saved .saved-market-icon {
		animation: heart-pop 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}
	.saved-market-toggle:active {
		transform: scale(0.92);
	}

	@media (prefers-reduced-motion: reduce) {
		.saved-market-toggle.is-saved .saved-market-icon {
			animation: none;
		}
		.saved-market-toggle:active {
			transform: none;
		}
	}
</style>
