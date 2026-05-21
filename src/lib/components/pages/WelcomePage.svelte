<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import WelcomeFinalCTA from '$lib/components/landing/WelcomeFinalCTA.svelte';
	import WelcomeFlowFeature from '$lib/components/landing/WelcomeFlowFeature.svelte';
	import WelcomeFooter from '$lib/components/landing/WelcomeFooter.svelte';
	import WelcomeLiveMarkets from '$lib/components/landing/WelcomeLiveMarkets.svelte';
	import WelcomeLoop from '$lib/components/landing/WelcomeLoop.svelte';
	import WelcomeSocialProof from '$lib/components/landing/WelcomeSocialProof.svelte';
	import WelcomeTrust from '$lib/components/landing/WelcomeTrust.svelte';
	import WelcomeUseCases from '$lib/components/landing/WelcomeUseCases.svelte';
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
					<div class="welcome-product-mockup">
						<div class="welcome-product-chrome">
							<span></span><span></span><span></span>
						</div>

						<div class="welcome-deck">
							<div class="welcome-deck-card welcome-deck-card--back"></div>
							<div class="welcome-deck-card welcome-deck-card--mid"></div>
							<div class="welcome-deck-card welcome-deck-card--front">
								<div class="welcome-deck-top">
									<p class="eyebrow">{t({ locale: $localeStore, key: 'welcome.deck.category' })}</p>
									<span class="num">47d</span>
								</div>
								<p class="welcome-deck-question">
									{t({ locale: $localeStore, key: 'welcome.deck.question' })}
								</p>
								<div class="welcome-deck-meter" aria-hidden="true">
									<span></span>
								</div>
								<p class="num welcome-deck-consensus">
									{t({ locale: $localeStore, key: 'welcome.deck.consensus' })}
								</p>
								<div class="welcome-question-grid">
									<span>
										<strong class="num">YES</strong>
										<small>62%</small>
									</span>
									<span>
										<strong class="num">NO</strong>
										<small>38%</small>
									</span>
									<span>
										<strong class="num">2.4M</strong>
										<small>{t({ locale: $localeStore, key: 'card.calls' })}</small>
									</span>
								</div>
							</div>
						</div>

						<div class="welcome-mockup-rail">
							<span>{t({ locale: $localeStore, key: 'loop.flow_name' })}</span>
							<span>{t({ locale: $localeStore, key: 'loop.market_name' })}</span>
							<span>{t({ locale: $localeStore, key: 'loop.port_name' })}</span>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section id="markets" class="welcome-section">
			<WelcomeLiveMarkets />
		</section>

		<section id="flow" class="welcome-section">
			<WelcomeFlowFeature />
		</section>

		<section id="leaderboard" class="welcome-section">
			<WelcomeSocialProof />
		</section>

		<section id="loop" class="welcome-section">
			<WelcomeLoop />
		</section>

		<section id="vision" class="welcome-section">
			<WelcomeUseCases />
		</section>

		<section id="trust" class="welcome-section welcome-section--trust">
			<WelcomeTrust />
		</section>

		<section class="welcome-final">
			<WelcomeFinalCTA />
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
		position: relative;
		overflow: hidden;
		padding: clamp(3rem, 7vw, 5rem) clamp(1.25rem, 4vw, 2rem) clamp(3.5rem, 6vw, 4.75rem);
		border-bottom: 1px solid var(--border);
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--laurel) 5%, transparent), transparent 58%),
			color-mix(in srgb, var(--background) 94%, var(--laurel) 6%);
	}

	.welcome-hero-inner {
		max-width: 80rem;
		margin: 0 auto;
		display: grid;
		gap: clamp(2.5rem, 6vw, 4rem);
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
		font-size: clamp(2.5rem, 6.5vw, 5rem);
		line-height: 1.02;
		letter-spacing: -0.04em;
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
		min-height: 19rem;
		margin: 0 auto;
	}

	.welcome-deck-card {
		position: absolute;
		inset: auto;
		width: 100%;
		border-radius: 20px;
		border: 1px solid var(--border);
		background: var(--card);
		box-shadow:
			var(--shadow-card),
			0 18px 48px -28px color-mix(in srgb, var(--foreground) 52%, transparent);
		padding: 1rem 1.125rem;
	}

	.welcome-deck-card--back {
		transform: translate(-28px, -20px) rotate(-4deg);
		opacity: 0.48;
		min-height: 14.5rem;
	}

	.welcome-deck-card--mid {
		transform: translate(-14px, -10px) rotate(-2deg);
		opacity: 0.72;
		min-height: 15.75rem;
	}

	.welcome-deck-card--front {
		position: relative;
		z-index: 2;
		display: flex;
		min-height: 17rem;
		flex-direction: column;
		gap: 0.85rem;
		background:
			linear-gradient(155deg, color-mix(in srgb, var(--laurel) 12%, transparent), transparent 58%),
			var(--card);
	}

	.welcome-hero-visual {
		position: relative;
		min-height: 26rem;
	}

	.welcome-product-mockup {
		position: relative;
		width: min(100%, 27rem);
		margin: 0 auto;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: 28px;
		background:
			radial-gradient(
				circle at 82% 10%,
				color-mix(in srgb, var(--laurel) 18%, transparent),
				transparent 34%
			),
			color-mix(in srgb, var(--card) 92%, var(--background) 8%);
		box-shadow:
			0 24px 70px -34px color-mix(in srgb, var(--foreground) 38%, transparent),
			inset 0 1px 0 color-mix(in srgb, var(--background) 76%, transparent);
	}

	.welcome-product-chrome {
		display: flex;
		gap: 0.35rem;
		padding: 0.25rem 0.25rem 0.85rem;
	}

	.welcome-product-chrome span {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		background: var(--border-strong);
	}

	.welcome-product-chrome span:first-child {
		background: var(--no);
	}

	.welcome-product-chrome span:nth-child(2) {
		background: var(--laurel);
	}

	.welcome-product-chrome span:last-child {
		background: var(--yes);
	}

	.welcome-deck-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.welcome-deck-top p {
		margin: 0;
	}

	.welcome-deck-top .num {
		color: var(--muted-foreground);
		font-size: var(--t-12);
	}

	.welcome-deck-question {
		margin: 0;
		font-size: clamp(1.15rem, 3vw, 1.35rem);
		font-weight: 700;
		line-height: 1.18;
		letter-spacing: -0.015em;
		color: var(--foreground);
		text-wrap: balance;
	}

	.welcome-deck-meter {
		overflow: hidden;
		height: 0.45rem;
		border-radius: 999px;
		background: var(--no-wash);
	}

	.welcome-deck-meter span {
		display: block;
		width: 62%;
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, var(--yes-deep), var(--yes));
	}

	.welcome-deck-consensus {
		margin: 0;
		color: var(--laurel);
		font-size: var(--t-12);
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.welcome-question-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.55rem;
		margin-top: auto;
	}

	.welcome-question-grid span {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.65rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: color-mix(in srgb, var(--foreground) 3%, transparent);
	}

	.welcome-question-grid strong {
		color: var(--foreground);
		font-size: var(--t-13);
	}

	.welcome-question-grid small {
		color: var(--muted-foreground);
		font-size: var(--t-12);
	}

	.welcome-mockup-rail {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
		margin-top: 0.85rem;
	}

	.welcome-mockup-rail span {
		padding: 0.6rem 0.4rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: color-mix(in srgb, var(--foreground) 3%, transparent);
		color: var(--muted-foreground);
		font-size: var(--t-12);
		font-weight: 700;
		text-align: center;
	}

	.welcome-mockup-rail span:first-child {
		background: var(--laurel);
		color: var(--ink);
	}

	.welcome-section {
		padding: clamp(4rem, 8vw, 6rem) clamp(1.25rem, 4vw, 2rem);
	}

	.welcome-section--trust {
		background: color-mix(in srgb, var(--foreground) 2%, transparent);
	}

	.welcome-final {
		padding: 4rem clamp(1.25rem, 4vw, 2rem) 2rem;
	}
</style>
