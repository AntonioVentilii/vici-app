<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import SignInProviderStack from '$lib/components/authn/SignInProviderStack.svelte';
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

	const termsHref = `${PublicPath.Info}/terms`;
	const privacyHref = `${PublicPath.Info}/privacy`;

	const handleSwitch = () => {
		void goto(resolve(isSignUp ? PublicPath.SignIn : PublicPath.SignUp));
	};
</script>

<div class="signin-wrap">
	<div class="signin-card">
		<header class="signin-head">
			<svg
				class="signin-wordmark"
				aria-label="VICI"
				fill="currentColor"
				role="img"
				viewBox="0 0 262 120"
				xmlns="http://www.w3.org/2000/svg"
			>
				<g>
					<path d="M 6 14 L 30 14 L 50 88 L 70 14 L 94 14 L 64 106 L 36 106 Z" />
					<path d="M 102 14 L 124 14 L 124 106 L 102 106 Z" />
					<path
						d="M 222 30 C 214 20 200 14 184 14 C 158 14 140 35 140 60 C 140 85 158 106 184 106 C 200 106 214 100 222 90 L 204 78 C 198 84 192 86 184 86 C 170 86 162 76 162 60 C 162 44 170 34 184 34 C 192 34 198 36 204 42 Z"
					/>
					<path d="M 234 14 L 256 14 L 256 106 L 234 106 Z" />
				</g>
			</svg>

			<p class="allcaps signin-eyebrow">{t({ locale: $localeStore, key: eyebrowKey })}</p>
			<h1 class="signin-title">
				{titleParts.before}<span class="serif-italic">VICI.</span>{titleParts.after}
			</h1>
			<p class="signin-sub">{t({ locale: $localeStore, key: subcopyKey })}</p>

			<div class="signin-proof allcaps">
				<span>
					<b class="num">{t({ locale: $localeStore, key: 'signin.proof.predictors_count' })}</b>
					{t({ locale: $localeStore, key: 'signin.proof.predictors_label' })}
				</span>
				<span class="signin-proof-dot" aria-hidden="true">·</span>
				<span>
					<b class="num">{t({ locale: $localeStore, key: 'signin.proof.calls_count' })}</b>
					{t({ locale: $localeStore, key: 'signin.proof.calls_label' })}
				</span>
			</div>
		</header>

		<div class="signin-providers">
			<SignInProviderStack {onSuccess} />
		</div>

		<footer class="signin-foot">
			<span class="signin-foot-mute">{t({ locale: $localeStore, key: footerPromptKey })}</span>
			<button class="signin-link" onclick={handleSwitch} type="button">
				{t({ locale: $localeStore, key: footerCtaKey })}
			</button>
		</footer>
	</div>

	<div class="signin-legal">
		<p class="signin-legal-line">
			{t({ locale: $localeStore, key: 'signin.legal.line1' })}
		</p>
		<p class="signin-legal-line is-dim">
			{t({ locale: $localeStore, key: 'signin.legal.line2.prefix' })}
			<a href={termsHref}>{t({ locale: $localeStore, key: 'signin.legal.terms' })}</a>
			{t({ locale: $localeStore, key: 'signin.legal.line2.and' })}
			<a href={privacyHref}>{t({ locale: $localeStore, key: 'signin.legal.privacy' })}</a>.
		</p>
	</div>
</div>

<style lang="postcss">
	.signin-wrap {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
		min-height: 100dvh;
		overflow-y: auto;
		padding: max(1.75rem, env(safe-area-inset-top, 0px)) 1.5rem
			max(1.5rem, env(safe-area-inset-bottom, 0px));
		background: var(--bg-base);
	}

	.signin-card {
		width: 100%;
		max-width: 26.25rem;
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		gap: 1.5rem;
		margin: 0 auto;
		padding: 0.25rem 0 0;
	}

	.signin-head {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.625rem;
		padding-top: 0.5rem;
		text-align: left;
	}

	.signin-wordmark {
		width: auto;
		height: 3rem;
		color: var(--laurel);
		margin-bottom: 0.5rem;
	}

	.signin-eyebrow {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		letter-spacing: 0.18em;
	}

	.signin-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(var(--t-28), 7.5vw, var(--t-32));
		font-weight: 600;
		line-height: 1.1;
		letter-spacing: -0.01em;
		color: var(--text-base);
	}

	.signin-title .serif-italic {
		color: var(--laurel);
	}

	.signin-sub {
		margin: 0;
		max-width: 21rem;
		font-size: var(--t-14);
		line-height: 1.45;
		color: var(--text-muted);
	}

	.signin-proof {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		margin-top: 0.5rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		letter-spacing: 0.14em;
	}

	.signin-proof b {
		color: var(--text-base);
		font-weight: 700;
	}

	.signin-proof-dot {
		color: var(--parchment-faint);
	}

	.signin-providers {
		display: flex;
		flex-direction: column;
		gap: 0;
		margin-top: 0.25rem;
	}

	.signin-providers :global(> *) {
		width: 100%;
	}

	.signin-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		margin-top: auto;
		padding-top: 1rem;
		font-size: var(--t-14);
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
		cursor: pointer;
		transition: color var(--d-hover) var(--ease-vici);
	}

	.signin-link:hover {
		color: var(--laurel-deep);
	}

	.signin-legal {
		width: 100%;
		max-width: 26.25rem;
		margin: 1.25rem auto 0.5rem;
		text-align: center;
	}

	.signin-legal-line {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.72rem;
		line-height: 1.55;
	}

	.signin-legal-line + .signin-legal-line {
		margin-top: 0.25rem;
	}

	.signin-legal-line.is-dim {
		color: var(--parchment-faint);
	}

	.signin-legal-line a {
		color: var(--text-muted);
		text-decoration: underline;
		text-decoration-color: var(--parchment-faint);
		text-underline-offset: 0.2em;
		transition: text-decoration-color var(--d-hover) var(--ease-vici);
	}

	.signin-legal-line a:hover {
		text-decoration-color: var(--laurel);
		color: var(--text-base);
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
			background: var(--bg-surface);
			box-shadow: var(--inset-hi-strong), var(--shadow-modal);
		}

		.signin-legal {
			margin-top: 1.5rem;
		}
	}
</style>
