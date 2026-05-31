<script lang="ts">
	import { Heart } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { userSignedIn } from '$lib/derived/user.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import {
		isMarketSaved,
		preferencesStore,
		toggleSavedMarket
	} from '$lib/stores/preferences.store';
	import { t } from '$lib/utils/i18n.utils';

	type ToggleSize = 'sm' | 'md';
	type ToggleVariant = 'pill' | 'ghost';

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
		/** Treatment variant.
		 *
		 *  - `pill` (default) — bordered laurel pill; the saved state fills
		 *    with the laurel wash.
		 *  - `ghost` — borderless square (8 px radius) that sits flush in a
		 *    dense action row; transparent until hovered, and the saved
		 *    heart turns pink rather than laurel so it reads as a personal
		 *    watchlist mark next to the neutral share control (see
		 *    `FlowBackHeader`).
		 */
		variant?: ToggleVariant;
		/** Hard-stop the click from bubbling to a parent clickable surface
		 *  (e.g. a `<Card>` that navigates on click). Defaults to `true`
		 *  because both current call sites need it and forgetting is a
		 *  silent bug. */
		stopPropagation?: boolean;
	}

	const { marketId, size = 'sm', variant = 'pill', stopPropagation = true }: Props = $props();

	const saved = $derived(isMarketSaved({ marketId, prefs: $preferencesStore }));

	const onClick = (e: MouseEvent) => {
		if (stopPropagation) {
			e.stopPropagation();
		}

		// `/markets` and `/markets/[id]` are public surfaces; an anonymous
		// visitor tapping the heart should be routed to signin instead of
		// writing to an unattached `preferencesStore` whose value can't
		// persist back to a profile.
		if (!$userSignedIn) {
			void goto(resolve(PublicPath.SignIn));

			return;
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
	class={['saved-market-toggle', `size-${size}`, `variant-${variant}`, saved && 'is-saved']}
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

	/* Ghost treatment — a borderless 8 px-radius square that reads as a
	   neutral icon affordance until interacted with. Saved state turns
	   the heart pink so a watchlisted card is unmistakable next to the
	   neutral share control in the dense flow-back action row. */
	.variant-ghost {
		border: 1px solid transparent;
		border-radius: var(--r-8);
		background: transparent;
		color: var(--text-muted);
	}
	.variant-ghost:hover {
		border-color: transparent;
		background: color-mix(in srgb, var(--parchment) 6%, transparent);
		color: var(--text-base);
	}
	.variant-ghost.is-saved {
		border-color: transparent;
		background: transparent;
		color: #ff6b8a;
	}

	.size-md {
		width: 2.25rem;
		height: 2.25rem;
		background: color-mix(in srgb, var(--bg-surface) 84%, transparent);
		color: var(--text-muted);
	}

	/* Heart-pop envelope on save toggle — visual punch that
	   substitutes for the haptic on iOS Safari (Vibration API
	   absent there). */
	.saved-market-icon {
		display: inline-flex;
	}
	.saved-market-toggle.is-saved .saved-market-icon {
		animation: heart-pop var(--d-enter) cubic-bezier(0.22, 1, 0.36, 1) both;
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
