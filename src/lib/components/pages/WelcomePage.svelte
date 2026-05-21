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
					<div class="welcome-deck">
						<div class="welcome-deck-card welcome-deck-card--back"></div>
						<div class="welcome-deck-card welcome-deck-card--mid"></div>
						<article class="welcome-deck-card welcome-deck-card--front">
							<header class="welcome-deck-head">
								<span class="welcome-deck-tag">
									{t({ locale: $localeStore, key: 'welcome.deck.category' })}
								</span>
								<span class="num welcome-deck-time">47d</span>
							</header>

							<p class="welcome-deck-status">
								<span class="welcome-deck-dot welcome-deck-dot--no"></span>
								{t({ locale: $localeStore, key: 'welcome.deck.closing_soon' })}
							</p>

							<h3 class="welcome-deck-question">
								{t({ locale: $localeStore, key: 'welcome.deck.question' })}
							</h3>
							<p class="welcome-deck-subtitle">
								{t({ locale: $localeStore, key: 'welcome.deck.subtitle' })}
							</p>

							<div class="welcome-deck-predictors">
								<span class="welcome-avatars">
									<span class="welcome-avatars-dot"></span>
									<span class="welcome-avatars-dot"></span>
									<span class="welcome-avatars-dot"></span>
									<span class="welcome-avatars-dot"></span>
								</span>
								<span class="num welcome-deck-meta">
									{t({
										locale: $localeStore,
										key: 'welcome.deck.predictors_count',
										params: { count: '2,847' }
									})}
								</span>
							</div>

							<div class="welcome-deck-chart">
								<svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 200 60">
									<path
										class="welcome-deck-chart-line"
										d="M0,42 C20,40 30,38 50,34 C70,30 90,28 110,22 C130,18 150,16 170,12 C185,10 195,8 200,6"
										fill="none"
									/>
								</svg>
							</div>

							<p class="welcome-deck-sharp num">
								<span class="welcome-deck-dot welcome-deck-dot--laurel"></span>
								<span>
									{t({
										locale: $localeStore,
										key: 'card.sharp_signal',
										params: { percent: '74', side: 'YES' }
									})}
								</span>
							</p>

							<div class="welcome-deck-actions">
								<div class="welcome-deck-action welcome-deck-action--no">
									<span class="welcome-deck-action-arrow" aria-hidden="true">‹</span>
									<span class="welcome-deck-action-label">NO</span>
									<span class="welcome-deck-action-pct num">36%</span>
								</div>
								<div class="welcome-deck-action welcome-deck-action--yes">
									<span class="welcome-deck-action-label">YES</span>
									<span class="welcome-deck-action-pct num">64%</span>
									<span class="welcome-deck-action-arrow" aria-hidden="true">›</span>
								</div>
							</div>

							<footer class="welcome-deck-foot num">
								<span>2.4M {t({ locale: $localeStore, key: 'card.calls' })}</span>
								<span>{t({ locale: $localeStore, key: 'card.tap_depth' })}</span>
							</footer>
						</article>
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

	.welcome-hero-visual {
		position: relative;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding: clamp(1.5rem, 4vw, 2.75rem) 0;
		min-height: 26rem;
	}

	.welcome-deck {
		position: relative;
		width: min(100%, 26rem);
		aspect-ratio: 4 / 5;
	}

	.welcome-deck-card {
		position: absolute;
		inset: 0;
		border-radius: var(--r-12);
		border: 1px solid var(--border-base);
		background: var(--bg-popover);
		box-shadow:
			var(--shadow-card),
			0 26px 60px -34px color-mix(in srgb, var(--ink) 55%, transparent);
	}

	.welcome-deck-card--back {
		transform: translate(36px, -22px) rotate(6deg);
		background: color-mix(in srgb, var(--bg-popover) 92%, var(--ink) 8%);
		opacity: 0.55;
	}

	.welcome-deck-card--mid {
		transform: translate(20px, -12px) rotate(3deg);
		background: color-mix(in srgb, var(--bg-popover) 96%, var(--ink) 4%);
		opacity: 0.78;
	}

	.welcome-deck-card--front {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1.1rem 1.1rem 0.9rem;
	}

	.welcome-deck-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.welcome-deck-tag {
		font-family: var(--font-display);
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		padding: 0.25rem 0.5rem;
		border-radius: var(--r-4);
		color: var(--cat-tech);
		background: color-mix(in srgb, var(--cat-tech) 14%, transparent);
	}

	.welcome-deck-time {
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.welcome-deck-status {
		margin: -0.15rem 0 0;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: var(--t-12);
		font-weight: 600;
		color: var(--no);
	}

	.welcome-deck-dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: currentColor;
		flex-shrink: 0;
	}

	.welcome-deck-dot--no {
		color: var(--no);
		animation: welcome-pulse 1.6s infinite;
	}

	.welcome-deck-dot--laurel {
		color: var(--laurel);
	}

	.welcome-deck-question {
		margin: 0.1rem 0 0;
		font-size: clamp(1.25rem, 2.5vw, 1.5rem);
		font-weight: 700;
		line-height: 1.18;
		letter-spacing: -0.02em;
		color: var(--foreground);
		text-wrap: balance;
	}

	.welcome-deck-subtitle {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.welcome-deck-predictors {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin-top: 0.15rem;
	}

	.welcome-avatars {
		display: inline-flex;
	}

	.welcome-avatars-dot {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 999px;
		background: var(--ink);
		border: 2px solid var(--bg-popover);
		margin-left: -0.4rem;
	}

	.welcome-avatars-dot:first-child {
		margin-left: 0;
	}

	.welcome-deck-meta {
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.welcome-deck-chart {
		position: relative;
		flex: 1;
		min-height: 4rem;
		border-radius: var(--r-8);
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--laurel) 12%, transparent),
				color-mix(in srgb, var(--laurel) 4%, transparent)
			),
			color-mix(in srgb, var(--bg-base) 86%, var(--laurel) 14%);
		overflow: hidden;
	}

	.welcome-deck-chart svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.welcome-deck-chart-line {
		stroke: var(--yes);
		stroke-width: 1.75;
		stroke-linecap: round;
		stroke-linejoin: round;
		filter: drop-shadow(0 1px 2px color-mix(in srgb, var(--yes) 35%, transparent));
	}

	.welcome-deck-sharp {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
		font-size: var(--t-12);
		font-weight: 700;
		color: var(--color-warning);
	}

	.welcome-deck-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.55rem;
	}

	.welcome-deck-action {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.85rem 0.6rem;
		border-radius: var(--r-8);
		font-family: var(--font-display);
		font-weight: 700;
	}

	.welcome-deck-action-label {
		font-size: var(--t-12);
		letter-spacing: var(--tracking-allcaps);
	}

	.welcome-deck-action-pct {
		font-size: var(--t-20);
		font-weight: 700;
	}

	.welcome-deck-action-arrow {
		font-size: 1.05rem;
		opacity: 0.7;
	}

	.welcome-deck-action--no {
		color: var(--color-destructive);
		background: var(--no-wash);
		border: 1px solid color-mix(in srgb, var(--color-destructive) 22%, transparent);
	}

	.welcome-deck-action--yes {
		color: var(--color-success);
		background: var(--yes-wash);
		border: 1px solid color-mix(in srgb, var(--color-success) 22%, transparent);
	}

	.welcome-deck-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin: 0;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-base);
		font-size: var(--t-12);
		color: var(--text-muted);
		letter-spacing: 0.04em;
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
