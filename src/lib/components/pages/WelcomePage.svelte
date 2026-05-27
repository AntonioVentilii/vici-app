<script lang="ts">
	/**
	 * Verbatim port of the prototype's `Landing` component
	 * (`landing.jsx:20-46`). Renders WelcomeNav (desktop+mobile),
	 * Ticker (locked at top per user request — the only intentional
	 * divergence), Hero, WCFeature, LiveMarkets, FlowFeature,
	 * SocialProof, Loop, FAQ, TrustAndClose, Footer.
	 *
	 * The hero copy + visual is inlined here (rather than extracted)
	 * to mirror the prototype's `<Hero>` (`landing.jsx:384-426`),
	 * which is also a single inline JSX block.
	 */
	import { ChevronRight, Clock } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import WelcomeFAQ from '$lib/components/landing/WelcomeFAQ.svelte';
	import WelcomeFeaturedEvent from '$lib/components/landing/WelcomeFeaturedEvent.svelte';
	import WelcomeFlowFeature from '$lib/components/landing/WelcomeFlowFeature.svelte';
	import WelcomeFooter from '$lib/components/landing/WelcomeFooter.svelte';
	import WelcomeHeroDeck from '$lib/components/landing/WelcomeHeroDeck.svelte';
	import WelcomeLiveMarkets from '$lib/components/landing/WelcomeLiveMarkets.svelte';
	import WelcomeLoop from '$lib/components/landing/WelcomeLoop.svelte';
	import WelcomeSocialProof from '$lib/components/landing/WelcomeSocialProof.svelte';
	import WelcomeTrustAndClose from '$lib/components/landing/WelcomeTrustAndClose.svelte';
	import Ticker from '$lib/components/layout/Ticker.svelte';
	import WelcomeNav from '$lib/components/layout/WelcomeNav.svelte';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { WORLD_CUP_KICKOFF } from '$lib/constants/world-cup-kickoff.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	onMount(() => {
		document.title = 'VICI';

		// Lock the viewport on the marketing surface — the landing layout is
		// tuned to device-width and pinch-zoom-out exposes the page chrome
		// (background bleeds, off-canvas blocks). Restore on unmount so the
		// in-app surface keeps the default, accessible viewport.
		const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');

		if (meta === null) {
			return;
		}

		const previous = meta.content;
		meta.content =
			'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

		return () => {
			meta.content = previous;
		};
	});

	const wcDays = WORLD_CUP_KICKOFF.daysToKickoff;
</script>

<div class="lp-root">
	<WelcomeNav />

	<!-- Ticker stays at the TOP per user request — intentional, locked
	     divergence from the prototype (which places the ticker between
	     Hero and the WC feature block, landing.jsx:36). -->
	<Ticker />

	<main id="main">
		<section class="lp-hero">
			<div class="lp-hero-inner">
				<div class="lp-hero-copy">
					<div style="gap:8px; margin-bottom:14px; flex-wrap:wrap;" class="row">
						<span class="tag live">{t({ locale: $localeStore, key: 'hero.live' })}</span>
						<span class="eyebrow acc">
							{t({
								locale: $localeStore,
								key: 'hero.predictors',
								params: { count: '184,210' }
							})}
						</span>
						{#if wcDays !== null}
							<span
								style="
									color:var(--accent); background:rgba(226,184,66,0.10);
									border:1px solid rgba(226,184,66,0.30);
									padding:3px 8px; border-radius:999px;
									letter-spacing:0.12em;
								"
								class="eyebrow"
							>
								<Clock
									style="vertical-align: middle; margin-right: 4px;"
									size={11}
									strokeWidth={2}
								/>
								{t({
									locale: $localeStore,
									key: 'wc.kickoff_chip',
									params: { days: String(wcDays) }
								})}
							</span>
						{/if}
					</div>
					<h1 class="lp-h1">
						{t({ locale: $localeStore, key: 'hero.title_a' })}
						<span class="serif-italic acc">
							{t({ locale: $localeStore, key: 'hero.title_b' })}
						</span>
					</h1>
					<p class="lp-lede">
						{t({ locale: $localeStore, key: 'hero.lede_a' })}
						<span class="serif-italic acc">
							{t({ locale: $localeStore, key: 'hero.lede_b' })}
						</span>
					</p>
					<div class="lp-cta-block">
						<div style="gap:10px; flex-wrap:wrap;" class="row">
							<button
								class="btn btn-primary btn-lg"
								onclick={() => goto(PublicPath.SignUp)}
								type="button"
							>
								{t({ locale: $localeStore, key: 'cta.primary' })}
								<ChevronRight size={16} />
							</button>
							<button
								class="btn btn-ghost btn-lg"
								onclick={() => goto(AppPath.Markets)}
								type="button"
							>
								{t({ locale: $localeStore, key: 'cta.see_markets' })}
							</button>
						</div>
						<p class="num mute lp-cta-micro">
							{t({ locale: $localeStore, key: 'hero.micro' })}
						</p>
					</div>
					<div
						style="gap:24px; margin-top:32px; color:var(--fg-mute); flex-wrap:wrap;"
						class="row t-body-sm"
					>
						<span>
							<span style="color:var(--fg); font-weight:600;" class="num">184K</span>
							{t({ locale: $localeStore, key: 'hero.stat_active' })}
						</span>
						<span>
							<span style="color:var(--fg); font-weight:600;" class="num">2.1M</span>
							{t({ locale: $localeStore, key: 'hero.stat_calls' })}
						</span>
						<span>
							<span style="font-weight:600;" class="num yes">74%</span>
							{t({ locale: $localeStore, key: 'hero.stat_top' })}
						</span>
					</div>
				</div>
				<div class="lp-hero-visual">
					<WelcomeHeroDeck />
				</div>
			</div>
		</section>

		<WelcomeFeaturedEvent />
		<WelcomeLiveMarkets />
		<WelcomeFlowFeature />
		<WelcomeSocialProof />
		<WelcomeLoop />
		<WelcomeFAQ />
		<WelcomeTrustAndClose />
	</main>

	<WelcomeFooter />
</div>

<style lang="postcss">
	/* Background ambient gradients — the prototype lives on `body`,
	   but we scope to the landing root so non-landing routes (sign-in
	   modals, etc.) aren't tinted by the same wash. */
	.lp-root {
		min-height: 100dvh;
		background:
			radial-gradient(1200px 600px at 80% -20%, rgba(226, 184, 66, 0.08), transparent 60%),
			radial-gradient(1000px 700px at -10% 30%, rgba(107, 159, 255, 0.04), transparent 60%),
			var(--background);
	}
	:global([data-theme='light']) .lp-root,
	:global([data-theme='peach']) .lp-root {
		background:
			radial-gradient(1200px 600px at 80% -20%, rgba(226, 184, 66, 0.1), transparent 60%),
			radial-gradient(1000px 700px at -10% 30%, rgba(181, 70, 44, 0.04), transparent 60%),
			var(--background);
	}
</style>
