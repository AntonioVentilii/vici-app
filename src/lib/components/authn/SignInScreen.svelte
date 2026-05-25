<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import SignInActions from '$lib/components/authn/SignInActions.svelte';
	import Logo from '$lib/components/layout/Logo.svelte';
	import { PENDING_ONBOARDING_STORAGE_KEY } from '$lib/constants/profile.constants';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	interface Props {
		// Mode: `signin` for returning users (welcome-back framing),
		// `signup` for new accounts (currently routes to the onboarding
		// flow once  lands).
		mode?: 'signin' | 'signup';
		// Callback for after a successful auth handshake. Defaults to
		// navigating to `AppPath.Home`; routes calling this from a
		// layout can pass a different post-auth target.
		onSuccess?: () => void;
	}

	const {
		mode = 'signin',
		onSuccess = () => {
			void goto(resolve(AppPath.Home));
		}
	}: Props = $props();

	const BRAND_PLACEHOLDER = '{brand}';
	const welcomeHref = resolve(PublicPath.Welcome);
	const isSignUp = $derived(mode === 'signup');
	let hasPendingOnboarding = $state(false);

	onMount(() => {
		if (!browser) {
			return;
		}

		hasPendingOnboarding = localStorage.getItem(PENDING_ONBOARDING_STORAGE_KEY) !== null;
	});

	const onboardingComplete = $derived(
		page.url.searchParams.get('onboarded') === '1' || hasPendingOnboarding
	);

	const eyebrowKey = $derived<MessageKey>(
		onboardingComplete
			? 'signin.eyebrow.onboarded'
			: isSignUp
				? 'signin.eyebrow.signup'
				: 'signin.eyebrow.signin'
	);
	const titleKey = $derived<MessageKey>(
		onboardingComplete
			? 'signin.title.onboarded'
			: isSignUp
				? 'signin.title.signup'
				: 'signin.title.signin'
	);
	const subcopyKey = $derived<MessageKey>(
		onboardingComplete
			? 'signin.sub.onboarded'
			: isSignUp
				? 'signin.sub.signup'
				: 'signin.sub.signin'
	);
	const footerPromptKey = $derived<MessageKey>(
		isSignUp ? 'signin.footer.prompt.signin' : 'signin.footer.prompt.signup'
	);
	const footerCtaKey = $derived<MessageKey>(
		isSignUp ? 'signin.footer.cta.signin' : 'signin.footer.cta.signup'
	);
	const titleTemplate = $derived(t({ locale: $localeStore, key: titleKey }));
	const titleParts = $derived.by(() => {
		const brandIndex = titleTemplate.indexOf(BRAND_PLACEHOLDER);

		if (brandIndex < 0) {
			return { before: titleTemplate, after: '' };
		}

		return {
			before: titleTemplate.slice(0, brandIndex),
			after: titleTemplate.slice(brandIndex + BRAND_PLACEHOLDER.length)
		};
	});

	const handleSwitch = () => {
		void goto(resolve(isSignUp ? PublicPath.SignIn : PublicPath.SignUp));
	};
</script>

<div class="signin-wrap">
	<div class="signin-orb signin-orb-a" aria-hidden="true"></div>
	<div class="signin-orb signin-orb-b" aria-hidden="true"></div>

	<div class="signin-card">
		<header class="signin-head">
			<div class="signin-brand">
				<Logo href={welcomeHref} />
			</div>
			<p class="allcaps signin-eyebrow">{t({ locale: $localeStore, key: eyebrowKey })}</p>
			<h1 class="signin-title">
				{titleParts.before}<span class="serif-italic signin-wordmark">VICI.</span>{titleParts.after}
			</h1>
			<p class="signin-sub">{t({ locale: $localeStore, key: subcopyKey })}</p>
		</header>

		<div class="signin-providers">
			<SignInActions {onSuccess} />
		</div>

		<footer class="signin-foot">
			<span class="signin-foot-mute">{t({ locale: $localeStore, key: footerPromptKey })}</span>
			<button class="signin-link" onclick={handleSwitch} type="button">
				{t({ locale: $localeStore, key: footerCtaKey })}
			</button>
		</footer>
	</div>

	<p class="signin-legal">
		{t({ locale: $localeStore, key: 'signin.legal' })}
	</p>
</div>

<style lang="postcss">
	.signin-wrap {
		position: relative;
		isolation: isolate;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 1.25rem;
		min-height: 100dvh;
		overflow-y: auto;
		padding: max(1.75rem, env(safe-area-inset-top, 0px)) 1.25rem
			max(1.5rem, env(safe-area-inset-bottom, 0px));
		background:
			radial-gradient(circle at 52% -4rem, var(--laurel-glow), transparent 22rem),
			radial-gradient(circle at 0% 76%, var(--yes-wash), transparent 16rem), var(--bg-base);
	}

	.signin-card {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 26.25rem;
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		gap: 1.45rem;
		margin: 0 auto;
		padding: 0.25rem 0 0;
	}

	.signin-head {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.625rem;
		padding-top: 0.25rem;
		text-align: left;
	}

	.signin-brand {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2rem;
		margin-bottom: 1rem;
	}

	.signin-eyebrow {
		color: var(--laurel);
		letter-spacing: var(--tracking-allcaps);
	}

	.signin-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(var(--t-32), 8.5vw, var(--t-44));
		line-height: var(--leading-snug);
		font-weight: 600;
		letter-spacing: var(--tracking-snug);
		color: var(--text-base);
	}

	.signin-wordmark {
		color: var(--laurel);
	}

	.signin-sub {
		margin: 0;
		max-width: 21rem;
		font-size: var(--t-14);
		line-height: var(--leading-relaxed);
		color: var(--text-muted);
	}

	.signin-providers {
		display: flex;
		flex-direction: column;
		gap: 0;
		margin-top: 0.4rem;
	}

	.signin-providers :global(> div) {
		width: 100%;
	}

	.signin-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		margin-top: auto;
		padding-top: 0.9rem;
		font-size: var(--t-13);
		text-align: center;
	}

	.signin-foot-mute {
		color: var(--text-muted);
	}

	.signin-link {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		font-weight: 600;
		color: var(--laurel);
		text-decoration: underline;
		text-decoration-color: var(--parchment-faint);
		text-underline-offset: 0.2em;
		cursor: pointer;
		transition: text-decoration-color var(--d-hover) var(--ease-vici);
	}

	.signin-link:hover {
		text-decoration-color: var(--laurel);
	}

	.signin-legal {
		position: relative;
		z-index: 1;
		max-width: 25.5rem;
		margin: auto 0 0;
		padding: 0 0.5rem;
		text-align: center;
		font-size: var(--t-12);
		line-height: var(--leading-normal);
		color: var(--parchment-faint);
	}

	.signin-orb {
		position: absolute;
		z-index: 0;
		border-radius: 9999px;
		pointer-events: none;
		filter: blur(1px);
		opacity: 0.75;
	}

	.signin-orb-a {
		top: 10%;
		left: max(-8rem, 2vw);
		width: 12rem;
		height: 12rem;
		background: radial-gradient(circle, var(--yes-wash), transparent 68%);
	}

	.signin-orb-b {
		right: max(-10rem, 0vw);
		bottom: 4%;
		width: 16rem;
		height: 16rem;
		background: radial-gradient(circle, var(--laurel-glow), transparent 68%);
	}

	@media (min-width: 48rem) {
		.signin-wrap {
			justify-content: center;
			padding-block: 3rem;
		}

		.signin-card {
			flex: 0 1 auto;
			padding: 2rem;
			border: 1px solid var(--border-base);
			border-radius: var(--r-12);
			background:
				linear-gradient(
					180deg,
					color-mix(in srgb, var(--bg-surface) 90%, transparent),
					color-mix(in srgb, var(--bg-base) 96%, transparent)
				),
				var(--bg-surface);
			box-shadow: var(--inset-hi-strong), var(--shadow-modal);
			backdrop-filter: blur(1.5rem);
		}
	}
</style>
