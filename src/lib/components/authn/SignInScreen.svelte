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
		// `signup` for new accounts. Verbatim port of the prototype
		// `SignIn` surface (`VICI WebApp Beta V1.2/signin.jsx`).
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
		<div class="signin-head">
			<span class="signin-wordmark" aria-label="VICI">
				<span class="signin-wordmark-letters">VICI</span>
			</span>
			<p class="signin-eyebrow">{t({ locale: $localeStore, key: eyebrowKey })}</p>
			<h1 class="signin-title">
				{titleParts.before}<span class="serif-italic acc">VICI.</span>{titleParts.after}
			</h1>
			<p class="signin-sub">{t({ locale: $localeStore, key: subcopyKey })}</p>
			<div class="signin-proof">
				<span>
					<b class="num">{t({ locale: $localeStore, key: 'signin.proof.predictors_count' })}</b>
					{t({ locale: $localeStore, key: 'signin.proof.predictors_label' })}
				</span>
				<span class="dim">·</span>
				<span>
					<b class="num">{t({ locale: $localeStore, key: 'signin.proof.calls_count' })}</b>
					{t({ locale: $localeStore, key: 'signin.proof.calls_label' })}
				</span>
			</div>
		</div>

		<SignInProviderStack {onSuccess} />

		<div class="signin-foot">
			<span class="mute">{t({ locale: $localeStore, key: footerPromptKey })}</span>
			<button class="signin-link" onclick={handleSwitch} type="button">
				{t({ locale: $localeStore, key: footerCtaKey })}
			</button>
		</div>
	</div>

	<div class="signin-legal">
		<p class="signin-legal-line">
			{t({ locale: $localeStore, key: 'signin.legal.line1' })}
		</p>
		<p class="signin-legal-line dim">
			{t({ locale: $localeStore, key: 'signin.legal.line2.prefix' })}
			<a href={termsHref}>{t({ locale: $localeStore, key: 'signin.legal.terms' })}</a>
			{t({ locale: $localeStore, key: 'signin.legal.line2.and' })}
			<a href={privacyHref}>{t({ locale: $localeStore, key: 'signin.legal.privacy' })}</a>.
		</p>
	</div>
</div>
