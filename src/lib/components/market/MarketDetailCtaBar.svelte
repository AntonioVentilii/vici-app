<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		yesPercent: number;
		noPercent: number;
		disabled?: boolean;
		onPick: (side: 'YES' | 'NO') => void;
	}

	const { yesPercent, noPercent, disabled = false, onPick }: Props = $props();
</script>

<!-- Sticky bottom YES/NO CTA bar — port of `screens.jsx:287-299`. Tap
     a side to open the prediction sheet. The bar sits above the safe-
     area inset; the route layout hides the bottom mobile nav on this
     surface so the CTA isn't competing with the tab bar for the same
     slot. The gradient mask softens the seam where the bar meets the
     "Top predictors" list above. -->
<div class="market-cta-bar">
	<button
		class="market-cta market-cta-yes"
		aria-label={t({ locale: $localeStore, key: 'market.detail.cta.predict_yes' })}
		{disabled}
		onclick={() => onPick('YES')}
		type="button"
	>
		<span class="market-cta-label">{t({ locale: $localeStore, key: 'outcome.yes' })}</span>
		<span class="num market-cta-pct">· {yesPercent}%</span>
	</button>
	<button
		class="market-cta market-cta-no"
		aria-label={t({ locale: $localeStore, key: 'market.detail.cta.predict_no' })}
		{disabled}
		onclick={() => onPick('NO')}
		type="button"
	>
		<span class="market-cta-label">{t({ locale: $localeStore, key: 'outcome.no' })}</span>
		<span class="num market-cta-pct">· {noPercent}%</span>
	</button>
</div>

<style lang="postcss">
	.market-cta-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 40;
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem 1rem calc(env(safe-area-inset-bottom, 0px) + 0.875rem);
		background: linear-gradient(180deg, transparent, var(--bg) 30%);
		pointer-events: none;
	}

	.market-cta-bar > .market-cta {
		pointer-events: auto;
	}

	.market-cta {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		min-height: 3rem;
		padding: 0.75rem 1rem;
		border-radius: var(--r-12);
		font-size: var(--t-14);
		font-weight: 700;
		letter-spacing: 0.02em;
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			transform var(--d-hover) var(--ease-vici);
	}

	.market-cta:active {
		transform: scale(0.99);
	}

	.market-cta:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.market-cta-yes {
		background: color-mix(in srgb, var(--yes) 10%, transparent);
		color: var(--yes);
		border: 1px solid var(--yes);
	}

	.market-cta-yes:hover:not(:disabled) {
		background: color-mix(in srgb, var(--yes) 16%, transparent);
	}

	.market-cta-no {
		background: color-mix(in srgb, var(--no) 10%, transparent);
		color: var(--no);
		border: 1px solid var(--no);
	}

	.market-cta-no:hover:not(:disabled) {
		background: color-mix(in srgb, var(--no) 16%, transparent);
	}

	.market-cta-label {
		text-transform: uppercase;
		letter-spacing: var(--tracking-allcaps);
	}

	.market-cta-pct {
		font-weight: 600;
	}

	@media (min-width: 768px) {
		.market-cta-bar {
			max-width: 36rem;
			margin: 0 auto;
		}
	}
</style>
