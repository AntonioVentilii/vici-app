<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import LandingSectionHeader from '$lib/components/landing/LandingSectionHeader.svelte';
	import WelcomeFooter from '$lib/components/landing/WelcomeFooter.svelte';
	import WelcomeLiveMarkets from '$lib/components/landing/WelcomeLiveMarkets.svelte';
	import Ticker from '$lib/components/layout/Ticker.svelte';
	import WelcomeNav from '$lib/components/layout/WelcomeNav.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { userSignedIn } from '$lib/derived/user.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	$effect(() => {
		if ($userSignedIn) {
			void goto(AppPath.Home, { replaceState: true });
		}
	});

	onMount(() => {
		document.title = 'VICI';
	});
</script>

<div class="welcome-shell">
	<WelcomeNav />
	<Ticker />

	<main class="welcome-page">
		<section class="welcome-hero">
			<div class="welcome-hero-inner">
				<div class="welcome-hero-copy">
					<div class="welcome-hero-meta">
						<span class="welcome-live-tag">{t({ locale: $localeStore, key: 'hero.live' })}</span>
						<span class="eyebrow acc">
							{t({ locale: $localeStore, key: 'hero.predictors', params: { count: '184,210' } })}
						</span>
					</div>
					<h1 class="welcome-headline display">
						{t({ locale: $localeStore, key: 'hero.title_a' })}
						<span class="serif-italic acc">{t({ locale: $localeStore, key: 'hero.title_b' })}</span>
					</h1>
					<p class="welcome-lede lede">
						{t({ locale: $localeStore, key: 'hero.lede_a' })}
						<span class="serif-italic acc">{t({ locale: $localeStore, key: 'hero.lede_b' })}</span>
					</p>
					<div class="welcome-actions">
						<Button onclick={() => goto(PublicPath.SignUp)} size="lg">
							{t({ locale: $localeStore, key: 'cta.primary' })}
						</Button>
						<Button onclick={() => goto(PublicPath.SignIn)} size="lg" variant="outline">
							{t({ locale: $localeStore, key: 'cta.see_markets' })}
						</Button>
					</div>
					<p class="welcome-micro num">{t({ locale: $localeStore, key: 'hero.micro' })}</p>
					<div class="welcome-stats num">
						<span
							><strong>184K</strong>
							{t({ locale: $localeStore, key: 'hero.stat_active' })}</span
						>
						<span
							><strong>2.1M</strong>
							{t({ locale: $localeStore, key: 'hero.stat_calls' })}</span
						>
						<span class="text-yes"
							><strong>74%</strong>
							{t({ locale: $localeStore, key: 'hero.stat_top' })}</span
						>
					</div>
				</div>
				<div class="welcome-hero-visual" aria-hidden="true">
					<div class="welcome-deck">
						<div class="welcome-deck-card welcome-deck-card--back"></div>
						<div class="welcome-deck-card welcome-deck-card--mid"></div>
						<div class="welcome-deck-card welcome-deck-card--front">
							<p class="eyebrow">{t({ locale: $localeStore, key: 'welcome.deck.category' })}</p>
							<p class="welcome-deck-question">
								{t({ locale: $localeStore, key: 'welcome.deck.question' })}
							</p>
							<p class="num welcome-deck-consensus">
								{t({ locale: $localeStore, key: 'welcome.deck.consensus' })}
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section id="markets" class="welcome-section">
			<WelcomeLiveMarkets />
		</section>

		<section id="flow" class="welcome-section">
			<div class="welcome-section-inner">
				<LandingSectionHeader
					eyebrow={t({ locale: $localeStore, key: 'flow.eyebrow' })}
					sub={t({ locale: $localeStore, key: 'flow.lede' })}
					title={t({ locale: $localeStore, key: 'flow.title_a' })}
					titleAccent={t({ locale: $localeStore, key: 'flow.title_b' })}
				/>
			</div>
		</section>

		<section id="leaderboard" class="welcome-section">
			<div class="welcome-section-inner">
				<LandingSectionHeader
					eyebrow={t({ locale: $localeStore, key: 'social.eyebrow' })}
					sub={t({ locale: $localeStore, key: 'social.sub' })}
					title={t({ locale: $localeStore, key: 'social.title_a' })}
					titleAccent={t({ locale: $localeStore, key: 'social.title_b' })}
				/>
			</div>
		</section>

		<section id="trust" class="welcome-section">
			<div class="welcome-section-inner">
				<LandingSectionHeader
					eyebrow={t({ locale: $localeStore, key: 'trust.eyebrow' })}
					sub={t({ locale: $localeStore, key: 'trust.sub' })}
					title={t({ locale: $localeStore, key: 'trust.title_a' })}
					titleAccent={t({ locale: $localeStore, key: 'trust.title_b' })}
				/>
			</div>
		</section>

		<section class="welcome-final">
			<div class="welcome-section-inner">
				<h2 class="display">{t({ locale: $localeStore, key: 'final.title' })}</h2>
				<p class="lede">{t({ locale: $localeStore, key: 'final.lede' })}</p>
				<Button onclick={() => goto(PublicPath.SignUp)} size="lg">
					{t({ locale: $localeStore, key: 'cta.start_predict' })}
				</Button>
			</div>
		</section>
	</main>

	<WelcomeFooter />
</div>

<style lang="postcss">
	.welcome-shell {
		min-height: 100dvh;
		background:
			radial-gradient(
				1200px 600px at 80% -20%,
				color-mix(in srgb, var(--laurel) 8%, transparent),
				transparent 60%
			),
			radial-gradient(
				1000px 700px at -10% 30%,
				color-mix(in srgb, var(--primary) 4%, transparent),
				transparent 60%
			),
			var(--background);
	}

	.welcome-page {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.welcome-hero {
		padding: 2.5rem clamp(1.25rem, 4vw, 2rem) 3rem;
	}

	.welcome-hero-inner {
		max-width: 80rem;
		margin: 0 auto;
		display: grid;
		gap: 2.5rem;
		align-items: center;
	}

	@media (min-width: 56rem) {
		.welcome-hero-inner {
			grid-template-columns: 1fr 1fr;
		}
	}

	.welcome-hero-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.875rem;
	}

	.welcome-live-tag {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.45rem;
		border-radius: 4px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		background: color-mix(in srgb, var(--no) 10%, transparent);
		color: var(--no);
	}

	.welcome-live-tag::before {
		content: '';
		display: inline-block;
		width: 5px;
		height: 5px;
		margin-right: 6px;
		border-radius: 999px;
		background: var(--no);
		animation: welcome-pulse 1.6s infinite;
	}

	@keyframes welcome-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	.welcome-headline {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3.25rem);
		line-height: 1.02;
		color: var(--foreground);
	}

	.welcome-lede {
		margin: 1rem 0 0;
		max-width: 32rem;
	}

	.welcome-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1.25rem;
	}

	.welcome-micro {
		margin: 0.75rem 0 0;
		font-size: var(--t-12);
		color: var(--muted-foreground);
	}

	.welcome-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		margin-top: 2rem;
		font-size: var(--t-13);
		color: var(--muted-foreground);
	}

	.welcome-stats strong {
		color: var(--foreground);
		font-weight: 600;
	}

	.welcome-deck {
		position: relative;
		min-height: 16rem;
		max-width: 20rem;
		margin: 0 auto;
	}

	.welcome-deck-card {
		position: absolute;
		inset: auto;
		width: 100%;
		border-radius: 16px;
		border: 1px solid var(--border);
		background: var(--card);
		box-shadow: var(--shadow-card);
		padding: 1rem 1.125rem;
	}

	.welcome-deck-card--back {
		transform: translate(-32px, -24px) rotate(-4deg);
		opacity: 0.68;
		min-height: 10rem;
	}

	.welcome-deck-card--mid {
		transform: translate(-16px, -12px) rotate(-2deg);
		opacity: 0.84;
		min-height: 11rem;
	}

	.welcome-deck-card--front {
		position: relative;
		transform: none;
		z-index: 2;
	}

	.welcome-deck-question {
		margin: 0.5rem 0 0;
		font-size: var(--t-16);
		font-weight: 600;
		color: var(--foreground);
	}

	.welcome-deck-consensus {
		margin: 0.75rem 0 0;
		color: var(--laurel);
		font-size: var(--t-12);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.welcome-section {
		padding: 4rem clamp(1.25rem, 4vw, 2rem);
	}

	.welcome-section-inner {
		max-width: 80rem;
		margin: 0 auto;
	}

	.welcome-final {
		padding: 4rem clamp(1.25rem, 4vw, 2rem) 2rem;
		text-align: center;
	}

	.welcome-final .display {
		margin: 0;
		font-size: clamp(1.75rem, 4vw, 2.75rem);
	}

	.welcome-final .lede {
		margin: 1rem auto 1.5rem;
		max-width: 28rem;
	}
</style>
