<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Logo from '$lib/components/layout/Logo.svelte';
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

<main class="welcome-page">
	<header class="welcome-header">
		<Logo />
	</header>

	<section class="welcome-hero">
		<h1 class="welcome-headline display">{t({ locale: $localeStore, key: 'landing.hero' })}</h1>
		<p class="welcome-lede lede">
			Swipe. Commit. Track accuracy. Prediction markets on the Internet Computer.
		</p>
		<div class="welcome-actions">
			<Button onclick={() => goto(PublicPath.SignIn)} size="lg"
				>{t({ locale: $localeStore, key: 'landing.cta' })}</Button
			>
			<Button onclick={() => goto(PublicPath.SignUp)} size="lg" variant="outline"
				>Create account</Button
			>
		</div>
	</section>

	<section class="welcome-faq" aria-labelledby="welcome-faq-title">
		<h2 id="welcome-faq-title" class="eyebrow">How it works</h2>
		<ul class="welcome-faq-list">
			<li><strong>Flow</strong> — rapid-fire calls on live markets.</li>
			<li><strong>Markets</strong> — depth, resolution, and portfolio tracking.</li>
			<li><strong>Streak</strong> — daily flame rewards consistency.</li>
		</ul>
	</section>
</main>

<style lang="postcss">
	.welcome-page {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		gap: 2rem;
		padding: 1.5rem 1.25rem 3rem;
		max-width: 48rem;
		margin: 0 auto;
	}

	.welcome-header {
		padding-top: 0.5rem;
	}

	.welcome-hero {
		display: flex;
		flex-direction: column;
		gap: 1rem;
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

	.welcome-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 0.5rem;
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
