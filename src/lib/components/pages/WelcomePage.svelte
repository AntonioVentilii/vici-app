<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Logo from '$lib/components/layout/Logo.svelte';
	import Ticker from '$lib/components/layout/Ticker.svelte';
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

	const heroTitle = $derived(
		`${t({ locale: $localeStore, key: 'hero.title_a' })} ${t({ locale: $localeStore, key: 'hero.title_b' })}`
	);

	onMount(() => {
		document.title = 'VICI';
	});
</script>

<main class="welcome-page">
	<Ticker />

	<header class="welcome-header">
		<Logo />
	</header>

	<section class="welcome-hero">
		<p class="eyebrow welcome-live">{t({ locale: $localeStore, key: 'hero.live' })}</p>
		<h1 class="welcome-headline display">{heroTitle}</h1>
		<p class="welcome-lede lede">
			{t({ locale: $localeStore, key: 'hero.lede_a' })}
			{t({ locale: $localeStore, key: 'hero.lede_b' })}
		</p>
		<p class="welcome-micro num">{t({ locale: $localeStore, key: 'hero.micro' })}</p>
		<div class="welcome-actions">
			<Button onclick={() => goto(PublicPath.SignIn)} size="lg"
				>{t({ locale: $localeStore, key: 'cta.primary' })}</Button
			>
			<Button onclick={() => goto(PublicPath.SignUp)} size="lg" variant="outline"
				>{t({ locale: $localeStore, key: 'landing.cta.signup' })}</Button
			>
		</div>
	</section>

	<section class="welcome-faq" aria-labelledby="welcome-faq-title">
		<h2 id="welcome-faq-title" class="eyebrow">
			{t({ locale: $localeStore, key: 'landing.faq.title' })}
		</h2>
		<ul class="welcome-faq-list">
			<li>{t({ locale: $localeStore, key: 'landing.faq.flow' })}</li>
			<li>{t({ locale: $localeStore, key: 'landing.faq.markets' })}</li>
			<li>{t({ locale: $localeStore, key: 'landing.faq.streak' })}</li>
		</ul>
	</section>
</main>

<style lang="postcss">
	.welcome-page {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 0 0 3rem;
		max-width: 48rem;
		margin: 0 auto;
	}

	.welcome-header {
		padding: 1rem 1.25rem 0;
	}

	.welcome-hero {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0 1.25rem;
	}

	.welcome-live {
		margin: 0;
		color: var(--laurel);
	}

	.welcome-headline {
		margin: 0;
		color: var(--parchment);
	}

	.welcome-lede {
		margin: 0;
		max-width: 32rem;
		color: var(--parchment-mute);
	}

	.welcome-micro {
		margin: 0;
		font-size: var(--t-12);
		color: var(--parchment-faint);
	}

	.welcome-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.welcome-faq {
		padding: 0 1.25rem;
	}

	.welcome-faq-list {
		margin: 0.5rem 0 0;
		padding-left: 1.125rem;
		color: var(--parchment-mute);
		font-size: var(--t-14);
		line-height: var(--leading-relaxed);
	}

	.welcome-faq-list li + li {
		margin-top: 0.35rem;
	}
</style>
