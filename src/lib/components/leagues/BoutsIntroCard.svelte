<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		onDismiss: () => void;
	}

	let { onDismiss }: Props = $props();
</script>

<aside class="bouts-intro">
	<span class="serif-italic bouts-intro-lede">
		{t({ locale: $localeStore, key: 'bouts.intro.lede' })}
	</span>
	<p class="bouts-intro-body">
		{t({ locale: $localeStore, key: 'bouts.intro.body' })}
	</p>
	<button
		class="bouts-intro-dismiss"
		aria-label={t({ locale: $localeStore, key: 'bouts.intro.dismiss' })}
		onclick={onDismiss}
		type="button"
	>
		×
	</button>
</aside>

<style lang="postcss">
	.bouts-intro {
		position: relative;
		margin: 0.25rem 0;
		padding: 0.9rem 1.1rem 0.85rem;
		background: color-mix(in srgb, #e2b842 4%, transparent);
		border: 1px solid color-mix(in srgb, #e2b842 18%, var(--border-base));
		border-radius: var(--r-12);
	}

	.bouts-intro-lede {
		display: block;
		margin-bottom: 0.25rem;
		font-size: var(--t-13);
		color: var(--laurel);
	}

	.bouts-intro-body {
		margin: 0;
		padding-right: 1.4rem;
		font-size: var(--t-13);
		line-height: 1.5;
		color: var(--text-muted);
	}

	.bouts-intro-dismiss {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		appearance: none;
		width: 24px;
		height: 24px;
		font-size: 1.15rem;
		color: var(--text-muted);
		background: transparent;
		border: 0;
		cursor: pointer;
	}
</style>
