<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import LanguagePicker from '$lib/components/layout/LanguagePicker.svelte';
	import Logo from '$lib/components/layout/Logo.svelte';
	import WelcomeThemePicker from '$lib/components/layout/WelcomeThemePicker.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	let scrolled = $state(false);

	onMount(() => {
		const onScroll = () => {
			scrolled = window.scrollY > 8;
		};

		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });

		return () => window.removeEventListener('scroll', onScroll);
	});
</script>

<nav class="welcome-nav" class:is-scrolled={scrolled} aria-label="Landing">
	<div class="welcome-nav-inner">
		<div class="welcome-nav-logo">
			<Logo href={PublicPath.Welcome} />
		</div>

		<div class="welcome-nav-links">
			<a href="#markets">{t({ locale: $localeStore, key: 'nav.markets' })}</a>
			<a href="#flow">{t({ locale: $localeStore, key: 'nav.flow' })}</a>
			<a href="#leaderboard">{t({ locale: $localeStore, key: 'nav.leaderboard' })}</a>
			<a href="#trust">{t({ locale: $localeStore, key: 'nav.trust' })}</a>
		</div>

		<div class="welcome-nav-cta">
			<LanguagePicker />
			<WelcomeThemePicker />
			<span class="welcome-nav-divider" aria-hidden="true"></span>
			<Button onclick={() => goto(PublicPath.SignIn)} size="sm" variant="ghost">
				{t({ locale: $localeStore, key: 'nav.signin' })}
			</Button>
			<Button onclick={() => goto(PublicPath.SignUp)} size="sm">
				{t({ locale: $localeStore, key: 'nav.cta' })}
			</Button>
		</div>
	</div>
</nav>

<style lang="postcss">
	.welcome-nav {
		position: sticky;
		top: 0;
		z-index: 50;
		background: color-mix(in srgb, var(--background) 40%, transparent);
		backdrop-filter: blur(16px);
		border-bottom: 1px solid transparent;
		transition:
			background 200ms var(--ease-vici),
			border-color 200ms var(--ease-vici),
			box-shadow 200ms var(--ease-vici);
	}

	.welcome-nav.is-scrolled {
		background: color-mix(in srgb, var(--background) 78%, transparent);
		border-bottom-color: var(--border);
		box-shadow: 0 8px 24px -16px rgba(0, 0, 0, 0.4);
	}

	.welcome-nav-inner {
		max-width: 80rem;
		margin: 0 auto;
		padding: 0.75rem clamp(1.25rem, 4vw, 2rem);
		display: flex;
		align-items: center;
		gap: 2rem;
	}

	.welcome-nav-logo {
		display: inline-flex;
		flex-shrink: 0;
	}

	.welcome-nav-links {
		display: none;
		flex: 1;
		justify-content: center;
		gap: 1.75rem;
		font-size: var(--t-14);
		font-weight: 600;
		color: var(--muted-foreground);
	}

	.welcome-nav-links a:hover {
		color: var(--foreground);
	}

	.welcome-nav-cta {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.welcome-nav-divider {
		width: 1px;
		height: 1.25rem;
		background: var(--border);
		margin: 0 0.15rem;
	}

	@media (min-width: 64rem) {
		.welcome-nav-links {
			display: flex;
		}
	}
</style>
