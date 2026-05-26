<script lang="ts">
	import { ChevronRight } from 'lucide-svelte/icons';
	import { resolve } from '$app/paths';
	import LandingSectionHeader from '$lib/components/landing/LandingSectionHeader.svelte';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Combined Trust + Close section — mirrors the prototype's
	 * `<TrustAndClose>` panel (landing.jsx:1317-1356). Replaces the
	 * previous WelcomeTrust + WelcomeFinalCTA pair so the credibility
	 * wall and the final CTA read as one closing arc:
	 *
	 *   "Should I trust this?"  →  "What do I do next?"
	 *
	 * Reuses existing `trust.*`, `final.*`, `cta.start_predict`
	 * i18n keys — no new copy required.
	 */
	const TRUST_PILLARS = [
		{ id: 'public-data', titleKey: 'trust.p1_t', bodyKey: 'trust.p1_b' },
		{ id: 'same-info', titleKey: 'trust.p2_t', bodyKey: 'trust.p2_b' },
		{ id: 'visible-consensus', titleKey: 'trust.p3_t', bodyKey: 'trust.p3_b' }
	] as const satisfies readonly {
		id: string;
		titleKey: MessageKey;
		bodyKey: MessageKey;
	}[];
</script>

<div class="welcome-close-inner">
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

	<!-- Hairline divider between credibility wall and the close. -->
	<div class="welcome-close-divider" aria-hidden="true"></div>

	<!-- The close — Veni Vidi Vici mark, headline, lede, single CTA. -->
	<div class="welcome-close-body">
		<p class="serif-italic acc welcome-close-mark">
			{t({ locale: $localeStore, key: 'final.mark' })}
		</p>
		<h2 class="welcome-close-title display">
			{t({ locale: $localeStore, key: 'final.title' })}
		</h2>
		<p class="welcome-close-lede lede">{t({ locale: $localeStore, key: 'final.lede' })}</p>

		<div class="welcome-close-actions">
			<a class="welcome-close-cta" href={resolve(PublicPath.SignUp)}>
				{t({ locale: $localeStore, key: 'cta.start_predict' })}
				<ChevronRight aria-hidden="true" size={16} strokeWidth={2} />
			</a>
		</div>
	</div>
</div>

<style lang="postcss">
	.welcome-close-inner {
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
		transition: color 200ms var(--ease-vici);
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
		transition: color 200ms var(--ease-vici);
	}

	.welcome-trust-pillar:hover .welcome-trust-title {
		color: var(--color-accent);
	}

	.welcome-trust-body {
		margin: 0.5rem 0 0;
		color: var(--muted-foreground);
		font-size: var(--t-14);
		line-height: 1.6;
	}

	/* Hairline divider — short, centred, between credibility wall and the close. */
	.welcome-close-divider {
		height: 1px;
		max-width: 20rem;
		margin: 4rem auto 3.5rem;
		background: var(--border);
		opacity: 0.5;
	}

	.welcome-close-body {
		max-width: 38rem;
		margin: 0 auto;
		text-align: center;
	}

	.welcome-close-mark {
		margin: 0 0 1.125rem;
		font-size: clamp(1.35rem, 3vw, 1.625rem);
		line-height: 1;
	}

	.welcome-close-title {
		margin: 0;
		color: var(--foreground);
		font-size: clamp(1.75rem, 4vw, 2.75rem);
		line-height: 1.05;
	}

	.welcome-close-lede {
		max-width: 30rem;
		margin: 0.875rem auto 0;
	}

	.welcome-close-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.625rem;
		margin-top: 2rem;
	}

	.welcome-close-cta {
		display: inline-flex;
		min-height: 3.5rem;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.95rem 1.5rem;
		border-radius: 14px;
		background: var(--primary);
		color: var(--primary-foreground);
		font-size: var(--t-16);
		font-weight: 600;
		line-height: 1;
		text-decoration: none;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
		transition:
			transform 200ms var(--ease-vici),
			background 200ms var(--ease-vici);
	}

	.welcome-close-cta:hover {
		transform: translateY(-1px);
		background: var(--laurel-deep);
	}
</style>
