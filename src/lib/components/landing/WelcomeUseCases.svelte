<script lang="ts">
	import LandingSectionHeader from '$lib/components/landing/LandingSectionHeader.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	const USE_CASES = [
		{
			id: 'strategist',
			titleKey: 'use.strat_t',
			bodyKey: 'use.strat_b'
		},
		{
			id: 'visionary',
			titleKey: 'use.vis_t',
			bodyKey: 'use.vis_b'
		},
		{
			id: 'bold',
			titleKey: 'use.bold_t',
			bodyKey: 'use.bold_b'
		}
	] as const satisfies readonly {
		id: string;
		titleKey: MessageKey;
		bodyKey: MessageKey;
	}[];
</script>

<div class="welcome-section-inner">
	<LandingSectionHeader
		eyebrow={t({ locale: $localeStore, key: 'use.eyebrow' })}
		title={t({ locale: $localeStore, key: 'use.title_a' })}
		titleAccent={t({ locale: $localeStore, key: 'use.title_b' })}
		titleSuffix={t({ locale: $localeStore, key: 'use.title_c' })}
	/>

	<div class="welcome-use-grid">
		{#each USE_CASES as useCase (useCase.id)}
			<article class="welcome-use-card">
				<h3 class="welcome-use-title">{t({ locale: $localeStore, key: useCase.titleKey })}</h3>
				<p class="welcome-use-body">{t({ locale: $localeStore, key: useCase.bodyKey })}</p>
			</article>
		{/each}
	</div>
</div>

<style lang="postcss">
	.welcome-section-inner {
		max-width: 80rem;
		margin: 0 auto;
	}

	.welcome-use-grid {
		display: grid;
		gap: 1rem;
		margin-top: 3rem;
	}

	@media (min-width: 48rem) {
		.welcome-use-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.welcome-use-card {
		min-height: 10rem;
		padding: clamp(1.25rem, 3vw, 1.5rem);
		border: 1px solid var(--border);
		border-radius: 18px;
		background:
			linear-gradient(145deg, color-mix(in srgb, var(--laurel) 7%, transparent), transparent 48%),
			var(--card);
		box-shadow: var(--shadow-card);
	}

	.welcome-use-title {
		margin: 0;
		color: var(--foreground);
		font-size: var(--t-18);
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: -0.01em;
	}

	.welcome-use-body {
		margin: 0.5rem 0 0;
		color: var(--muted-foreground);
		font-size: var(--t-14);
		line-height: 1.55;
	}
</style>
