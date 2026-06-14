<script lang="ts">
	import { Globe } from '@lucide/svelte/icons';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		/** Native name of the language the translation is in (e.g. `Español`). */
		translatedLanguageLabel: string;
		/** Whether the original (on-chain) text is currently shown. */
		showOriginal: boolean;
		onToggle: () => void;
	}

	const { translatedLanguageLabel, showOriginal, onToggle }: Props = $props();
</script>

<div class="xl-toggle">
	<span class="xl-state">
		<Globe aria-hidden="true" size={12} />
		{showOriginal
			? t({ locale: $localeStore, key: 'market.translation.viewing_original' })
			: t({ locale: $localeStore, key: 'market.translation.viewing_translated' })}
	</span>
	<span class="xl-sep" aria-hidden="true">·</span>
	<button class="xl-link" onclick={onToggle} type="button">
		{showOriginal
			? t({
					locale: $localeStore,
					key: 'market.translation.view_in',
					params: { language: translatedLanguageLabel }
				})
			: t({ locale: $localeStore, key: 'market.translation.view_original' })}
	</button>
</div>

<style lang="postcss">
	.xl-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.625rem;
		font-size: 0.6875rem;
	}

	.xl-state {
		display: inline-flex;
		align-items: center;
		gap: 0.3125rem;
		color: var(--text-muted);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.xl-sep {
		color: var(--fg-faint);
	}

	/* The original-language access is the smaller, secondary affordance —
	   a quiet underlined link rather than a button-styled control. */
	.xl-link {
		border: 0;
		background: transparent;
		padding: 0;
		cursor: pointer;
		font: inherit;
		font-weight: 600;
		color: var(--text-muted);
		text-decoration: underline;
		text-underline-offset: 2px;
		text-decoration-color: var(--border-strong);
		transition:
			color 0.15s ease,
			text-decoration-color 0.15s ease;
	}

	.xl-link:hover {
		color: var(--accent);
		text-decoration-color: var(--accent);
	}
</style>
