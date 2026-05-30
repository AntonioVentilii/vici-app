<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';
</script>

<section class="friends-empty">
	<p class="friends-empty-quote">
		{t({ locale: $localeStore, key: 'arena.friends.empty.quote' })}
	</p>
	<p class="friends-empty-sub">
		{t({ locale: $localeStore, key: 'arena.friends.empty.sub' })}
	</p>
</section>

<style lang="postcss">
	.friends-empty {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: center;
		padding: 1.25rem 1rem;
		border: 1px dashed var(--border-base);
		border-radius: var(--r-16, 1rem);
		background: var(--bg-surface);
		text-align: center;
	}

	.friends-empty-quote {
		margin: 0;
		color: var(--color-primary);
		font-family: var(--font-serif, var(--font-display, serif));
		font-style: italic;
		font-size: var(--t-16);
	}

	.friends-empty-sub {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-13);
		line-height: var(--leading-snug);
	}
</style>
