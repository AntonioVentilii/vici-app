<script lang="ts">
	import { Clock } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import WelcomeFAQ from '$lib/components/landing/WelcomeFAQ.svelte';
	import WelcomeFeaturedEvent from '$lib/components/landing/WelcomeFeaturedEvent.svelte';
	import WelcomeFinalCTA from '$lib/components/landing/WelcomeFinalCTA.svelte';
	import WelcomeFlowFeature from '$lib/components/landing/WelcomeFlowFeature.svelte';
	import WelcomeFooter from '$lib/components/landing/WelcomeFooter.svelte';
	import WelcomeHeroFlowCard from '$lib/components/landing/WelcomeHeroFlowCard.svelte';
	import WelcomeLiveMarkets from '$lib/components/landing/WelcomeLiveMarkets.svelte';
	import WelcomeLoop from '$lib/components/landing/WelcomeLoop.svelte';
	import WelcomeSocialProof from '$lib/components/landing/WelcomeSocialProof.svelte';
	import WelcomeTrust from '$lib/components/landing/WelcomeTrust.svelte';
	import WelcomeUseCases from '$lib/components/landing/WelcomeUseCases.svelte';
	import Ticker from '$lib/components/layout/Ticker.svelte';
	import WelcomeNav from '$lib/components/layout/WelcomeNav.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { WELCOME_MARKET_PREVIEWS } from '$lib/constants/welcome-markets.constants';
	import { WORLD_CUP_KICKOFF } from '$lib/constants/world-cup-kickoff.constants';
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

	const [heroMarket] = WELCOME_MARKET_PREVIEWS;
	const wcDays = WORLD_CUP_KICKOFF.daysToKickoff;
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
						{#if wcDays !== null}
							<span class="welcome-wc-chip eyebrow acc">
								<Clock aria-hidden="true" size={11} strokeWidth={2} />
								{t({
									locale: $localeStore,
									key: 'wc.kickoff_chip',
									params: { days: String(wcDays) }
								})}
							</span>
						{/if}
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
						<Button onclick={() => goto(AppPath.Markets)} size="lg" variant="outline">
							{t({ locale: $localeStore, key: 'cta.see_markets' })}
						</Button>
					</div>
					<p class="welcome-micro num">{t({ locale: $localeStore, key: 'hero.micro' })}</p>
					<div class="welcome-stats num">
						<span
							><span class="num">184K</span>
							{t({ locale: $localeStore, key: 'hero.stat_active' })}</span
						>
						<span
							><span class="num">2.1M</span>
							{t({ locale: $localeStore, key: 'hero.stat_calls' })}</span
						>
						<span class="text-yes"
							><span class="num">74%</span>
							{t({ locale: $localeStore, key: 'hero.stat_top' })}</span
						>
					</div>
				</div>
				<div class="welcome-hero-visual">
					<div class="welcome-hero-card-frame">
						<WelcomeHeroFlowCard market={heroMarket} />
					</div>
				</div>
			</div>
		</section>

		<!-- Featured-event section — landing has a dedicated tentpole
		     block above LiveMarkets (WC). Self-gated on
		     featuredEventActive so the section disappears post-archive
		     without a layout change. Reads from the FeaturedEvent
		     abstraction; swapping the next event needs no template edit. -->
		<section id="featured-event" class="welcome-section">
			<WelcomeFeaturedEvent />
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

		<section id="faq" class="welcome-section">
			<WelcomeFAQ />
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
		animation: pulse-live 1.6s infinite;
	}

	@keyframes pulse-live {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	/* World Cup kickoff chip — accent-tinted pill mirroring the
	   prototype's inline-styled chip beside the LIVE tag. */
	.welcome-wc-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 3px 8px;
		border-radius: 999px;
		color: var(--color-accent);
		background: color-mix(in srgb, var(--color-accent) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
		letter-spacing: 0.12em;
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

	.welcome-stats :global(.num) {
		color: var(--foreground);
		font-weight: 600;
	}

	.welcome-stats .text-yes :global(.num) {
		color: var(--yes);
	}

	.welcome-hero-visual {
		position: relative;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding: clamp(1.5rem, 4vw, 2.75rem) 0;
	}

	.welcome-hero-card-frame {
		width: min(100%, 26rem);
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
