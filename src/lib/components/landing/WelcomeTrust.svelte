<script lang="ts">
	import LandingSectionHeader from '$lib/components/landing/LandingSectionHeader.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	const TRUST_PILLARS = [
		{
			id: 'public-data',
			titleKey: 'trust.p1_t',
			bodyKey: 'trust.p1_b'
		},
		{
			id: 'same-info',
			titleKey: 'trust.p2_t',
			bodyKey: 'trust.p2_b'
		},
		{
			id: 'visible-consensus',
			titleKey: 'trust.p3_t',
			bodyKey: 'trust.p3_b'
		}
	] as const satisfies readonly {
		id: string;
		titleKey: MessageKey;
		bodyKey: MessageKey;
	}[];
</script>

<div class="welcome-section-inner">
	<LandingSectionHeader
		eyebrow={t({ locale: $localeStore, key: 'trust.eyebrow' })}
		sub={t({ locale: $localeStore, key: 'trust.sub' })}
		title={t({ locale: $localeStore, key: 'trust.title_a' })}
		titleAccent={t({ locale: $localeStore, key: 'trust.title_b' })}
	/>

	<div class="welcome-trust-grid">
		{#each TRUST_PILLARS as pillar (pillar.id)}
			<article class="welcome-trust-pillar">
				<h3 class="welcome-trust-title">{t({ locale: $localeStore, key: pillar.titleKey })}</h3>
				<p class="welcome-trust-body">{t({ locale: $localeStore, key: pillar.bodyKey })}</p>
			</article>
		{/each}
	</div>
</div>

<style lang="postcss">
	.welcome-section-inner {
		max-width: 80rem;
		margin: 0 auto;
	}

	.welcome-trust-grid {
		display: grid;
		gap: 1rem;
		margin-top: 3rem;
	}

	@media (min-width: 48rem) {
		.welcome-trust-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.welcome-trust-pillar {
		position: relative;
		padding: clamp(1.25rem, 3vw, 1.5rem);
		border-top: 1px solid color-mix(in srgb, var(--laurel) 42%, transparent);
		background: color-mix(in srgb, var(--foreground) 2%, transparent);
	}

	.welcome-trust-pillar::before {
		content: '';
		position: absolute;
		top: -1px;
		left: 0;
		width: 2.25rem;
		height: 1px;
		background: var(--laurel);
		box-shadow: 0 0 18px color-mix(in srgb, var(--laurel) 45%, transparent);
	}

	.welcome-trust-title {
		margin: 0;
		color: var(--foreground);
		font-size: var(--t-18);
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: -0.01em;
	}

	.welcome-trust-body {
		margin: 0.5rem 0 0;
		color: var(--muted-foreground);
		font-size: var(--t-14);
		line-height: 1.6;
	}
</style>
