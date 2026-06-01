<script lang="ts">
	import { isWebAuthnAvailable, signIn } from '@junobuild/core';
	import { Check, ChevronRight, Mail } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import IconGoogle from '$lib/components/icons/IconGoogle.svelte';
	import IconIc from '$lib/components/icons/IconIC.svelte';
	import IconPasskey from '$lib/components/icons/IconPasskey.svelte';
	import IconRobot from '$lib/components/icons/IconRobot.svelte';
	import { II_MAX_TIME_TO_LIVE_NS } from '$lib/constants/app.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import { isDev, isNotSkylab, isProd } from '$lib/env/app.env';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		onSuccess?: () => void;
		// Styling treatment for the provider buttons. `'signin'` (default)
		// is the 12px-radius surface card used on `/signin`. `'onboarding'`
		// switches to the full-width pill treatment of the onboarding auth
		// gate — Google as the cream-filled primary pill, every other
		// provider as a dark pill.
		variant?: 'signin' | 'onboarding';
	}

	const { onSuccess, variant = 'signin' }: Props = $props();

	const isOnboarding = $derived(variant === 'onboarding');

	// Provider IDs used to drive per-provider loading + faded-others
	// state. Apple + email are placeholders until we ship the
	// corresponding back-end providers.
	type ProviderId = 'apple' | 'google' | 'email' | 'ii' | 'passkey' | 'dev';

	// Auth surfaces that are wired to a live back-end provider. Apple
	// + email render as disabled placeholders with a "Coming soon"
	// micro-label until we ship them.
	const EMAIL_ENABLED = false;
	const APPLE_ENABLED = false;

	// Per-provider visibility flags — show/hide the button entirely,
	// independent of the "coming soon" placeholder state above.
	const APPLE_LOGIN_ENABLED = true;
	const GOOGLE_LOGIN_ENABLED = true;
	const EMAIL_LOGIN_ENABLED = true;
	const INTERNET_IDENTITY_LOGIN_ENABLED = true;
	const PASSKEY_LOGIN_ENABLED = true;
	const DEV_LOGIN_ENABLED = true;

	let signingIn = $state<ProviderId | null>(null);
	let emailOpen = $state(false);
	let email = $state('');
	let phase = $state<'idle' | 'sent'>('idle');

	// Passkey (WebAuthn) is only worth offering on platforms that can
	// actually complete the ceremony — otherwise the button is a dead
	// end. The capability probe is async, so resolve it on mount and
	// hide the provider when it isn't available.
	let passkeyAvailable = $state(true);

	onMount(async () => {
		passkeyAvailable = await isWebAuthnAvailable();
	});

	const productionAvailable = $derived(isProd() && isNotSkylab());
	const emailValid = $derived(/\S+@\S+\.\S+/.test(email));
	const isBusy = $derived(signingIn !== null);
	// When the email row is expanded the other providers dim to 0.4.
	const isFaded = $derived(emailOpen && phase === 'idle' && signingIn === null);

	const startSignIn = async ({
		id,
		run
	}: {
		id: ProviderId;
		run: () => Promise<void>;
	}): Promise<void> => {
		if (signingIn !== null) {
			return;
		}

		signingIn = id;

		try {
			await run();
			onSuccess?.();
		} catch (err: unknown) {
			console.error(`${id} sign-in failed`, err);
		} finally {
			signingIn = null;
		}
	};

	const onGoogle = () =>
		startSignIn({
			id: 'google',
			run: async () => {
				await signIn({
					google: {
						options: {
							redirect: {
								clientId: isDev()
									? '794351932143-em7c7j4rko2ok5fhk4crhv6f44ifmpqv.apps.googleusercontent.com'
									: '215111139647-7hat1jefroe7tkgu5kds4s8sv4dgf3fu.apps.googleusercontent.com',
								redirectUrl: `${window.location.origin}/auth/callback/google`
							}
						}
					}
				});
			}
		});

	const onIi = () =>
		startSignIn({
			id: 'ii',
			run: async () => {
				await signIn({
					internet_identity: {
						options: {
							maxTimeToLiveInNanoseconds: II_MAX_TIME_TO_LIVE_NS
						}
					}
				});
			}
		});

	const onPasskey = () =>
		startSignIn({
			id: 'passkey',
			run: async () => {
				await signIn({ webauthn: {} });
			}
		});

	const onDev = () =>
		startSignIn({
			id: 'dev',
			run: async () => {
				await signIn({ dev: {} });
			}
		});

	const onEmailOpen = () => {
		if (isBusy) {
			return;
		}

		emailOpen = true;
	};

	const onEmailSubmit = (event: SubmitEvent) => {
		event.preventDefault();

		if (!EMAIL_ENABLED || !emailValid || isBusy) {
			return;
		}

		// When the magic-link back-end ships, this branch will call the
		// satellite endpoint and flip to the sent state. The UI is
		// wired so the future swap is a one-line change.
		phase = 'sent';
	};

	const onEmailReset = () => {
		phase = 'idle';
		signingIn = null;
	};

	const onSentContinue = () => {
		onSuccess?.();
	};
</script>

{#if phase === 'sent'}
	<div class="signin-sent">
		<div class="signin-sent-mark" aria-hidden="true">
			<Check size={22} strokeWidth={2} />
		</div>
		<h2 class="signin-sent-title">{t({ locale: $localeStore, key: 'signin.sent.title' })}</h2>
		<p class="signin-sent-body">
			{t({ locale: $localeStore, key: 'signin.sent.body.prefix' })}<span class="num">{email}</span
			>{t({ locale: $localeStore, key: 'signin.sent.body.suffix' })}
		</p>
		<button class="signin-sent-continue" onclick={onSentContinue} type="button">
			{t({ locale: $localeStore, key: 'signin.sent.continue' })}
			<ChevronRight aria-hidden="true" size={16} strokeWidth={2.2} />
		</button>
		<button class="signin-link" onclick={onEmailReset} type="button">
			{t({ locale: $localeStore, key: 'signin.sent.use_different' })}
		</button>
	</div>
{:else}
	<div class="signin-providers signin-providers-equal">
		<!-- Apple — disabled placeholder until backend ships. -->
		{#if APPLE_LOGIN_ENABLED}
			<button
				class="signin-provider-btn"
				class:is-faded={isFaded}
				class:is-loading={signingIn === 'apple'}
				class:is-onboarding={isOnboarding}
				class:ob-dark={isOnboarding}
				aria-busy={signingIn === 'apple'}
				disabled={!APPLE_ENABLED || isBusy}
				title={t({ locale: $localeStore, key: 'signin.provider.placeholder_title' })}
				type="button"
			>
				<span class="signin-provider-icon" aria-hidden="true">
					<svg fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
						<path
							d="M17.05 12.04c-.03-3.09 2.53-4.58 2.65-4.65-1.45-2.12-3.7-2.41-4.49-2.43-1.9-.19-3.71 1.12-4.68 1.12-.97 0-2.46-1.1-4.05-1.07C4.43 5.05 2.5 6.17 1.45 8.04c-2.18 3.77-.56 9.36 1.57 12.43 1.04 1.5 2.27 3.19 3.87 3.13 1.55-.06 2.14-1 4.02-1 1.87 0 2.4 1 4.04.97 1.67-.03 2.73-1.53 3.75-3.04 1.18-1.74 1.67-3.43 1.7-3.52-.04-.02-3.27-1.26-3.3-4.97zM14.07 3.45C14.93 2.4 15.51.95 15.35-.5c-1.25.05-2.78.83-3.67 1.86C10.87 2.27 10.18 3.79 10.36 5.18c1.4.11 2.83-.71 3.71-1.73z"
						/>
					</svg>
				</span>
				<span class="signin-provider-label">
					{signingIn === 'apple'
						? t({ locale: $localeStore, key: 'signin.loading.apple' })
						: t({ locale: $localeStore, key: 'signin.provider.apple' })}
				</span>
				{#if signingIn === 'apple'}
					<span class="signin-spinner" aria-hidden="true"></span>
				{:else if !APPLE_ENABLED}
					<small class="signin-provider-soon">
						{t({ locale: $localeStore, key: 'signin.provider.soon' })}
					</small>
				{/if}
			</button>
		{/if}

		<!-- Google — live. -->
		{#if GOOGLE_LOGIN_ENABLED}
			<button
				class="signin-provider-btn"
				class:is-faded={isFaded}
				class:is-loading={signingIn === 'google'}
				class:is-onboarding={isOnboarding}
				class:ob-cream={isOnboarding}
				aria-busy={signingIn === 'google'}
				disabled={isBusy}
				onclick={onGoogle}
				type="button"
			>
				<span class="signin-provider-icon" aria-hidden="true">
					<IconGoogle size="18px" />
				</span>
				<span class="signin-provider-label">
					{signingIn === 'google'
						? t({ locale: $localeStore, key: 'signin.loading.google' })
						: t({ locale: $localeStore, key: 'signin.provider.google' })}
				</span>
				{#if signingIn === 'google'}
					<span class="signin-spinner" aria-hidden="true"></span>
				{/if}
			</button>
		{/if}

		<!-- Email — progressive disclosure. -->
		{#if EMAIL_LOGIN_ENABLED}
			{#if !emailOpen}
				<button
					class="signin-provider-btn email"
					class:is-faded={isFaded}
					class:is-onboarding={isOnboarding}
					class:ob-dark={isOnboarding}
					disabled={isBusy}
					onclick={onEmailOpen}
					type="button"
				>
					<span class="signin-provider-icon" aria-hidden="true">
						<Mail size={18} strokeWidth={1.8} />
					</span>
					<span class="signin-provider-label">
						{t({ locale: $localeStore, key: 'signin.provider.email' })}
					</span>
					{#if !EMAIL_ENABLED}
						<small class="signin-provider-soon">
							{t({ locale: $localeStore, key: 'signin.provider.soon' })}
						</small>
					{/if}
				</button>
			{:else}
				<form class="signin-email-inline" onsubmit={onEmailSubmit}>
					<div class="signin-email-row">
						<span class="signin-email-icon" aria-hidden="true">
							<Mail size={16} strokeWidth={1.8} />
						</span>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							id="signin-email-input"
							class="signin-email-input num"
							autocapitalize="off"
							autocomplete="email"
							autofocus
							disabled={!EMAIL_ENABLED || isBusy}
							inputmode="email"
							placeholder={t({ locale: $localeStore, key: 'signin.email.placeholder' })}
							spellcheck="false"
							type="email"
							bind:value={email}
						/>
					</div>
					<button
						class="signin-email-submit"
						disabled={!EMAIL_ENABLED || !emailValid || isBusy}
						type="submit"
					>
						{signingIn === 'email'
							? t({ locale: $localeStore, key: 'signin.loading.email' })
							: t({ locale: $localeStore, key: 'signin.email.cta' })}
						{#if signingIn !== 'email'}
							<ChevronRight aria-hidden="true" size={16} strokeWidth={2.2} />
						{/if}
					</button>
					<p class="signin-fineprint">
						{EMAIL_ENABLED
							? t({ locale: $localeStore, key: 'signin.email.fineprint' })
							: t({ locale: $localeStore, key: 'signin.email.disabled_note' })}
					</p>
				</form>
			{/if}
		{/if}

		<!-- Internet Identity — production-need. Uses the shared
			 `signin-provider-btn` style. -->
		{#if INTERNET_IDENTITY_LOGIN_ENABLED}
			<button
				class="signin-provider-btn"
				class:is-faded={isFaded}
				class:is-loading={signingIn === 'ii'}
				class:is-onboarding={isOnboarding}
				class:ob-dark={isOnboarding}
				aria-busy={signingIn === 'ii'}
				disabled={isBusy || !productionAvailable}
				onclick={onIi}
				type="button"
			>
				<span class="signin-provider-icon" aria-hidden="true">
					<IconIc size="18px" />
				</span>
				<span class="signin-provider-label">
					{signingIn === 'ii'
						? t({ locale: $localeStore, key: 'signin.loading.ii' })
						: t({ locale: $localeStore, key: 'authn.signin_with.ii' })}
				</span>
				{#if signingIn === 'ii'}
					<span class="signin-spinner" aria-hidden="true"></span>
				{/if}
			</button>
		{/if}

		<!-- Passkey — production-need (C-8 keep). -->
		{#if PASSKEY_LOGIN_ENABLED && passkeyAvailable}
			<button
				class="signin-provider-btn"
				class:is-faded={isFaded}
				class:is-loading={signingIn === 'passkey'}
				class:is-onboarding={isOnboarding}
				class:ob-dark={isOnboarding}
				aria-busy={signingIn === 'passkey'}
				disabled={isBusy || !productionAvailable}
				onclick={onPasskey}
				type="button"
			>
				<span class="signin-provider-icon" aria-hidden="true">
					<IconPasskey size="18px" />
				</span>
				<span class="signin-provider-label">
					{signingIn === 'passkey'
						? t({ locale: $localeStore, key: 'signin.loading.passkey' })
						: t({ locale: $localeStore, key: 'authn.passkey.signin_button' })}
				</span>
				{#if signingIn === 'passkey'}
					<span class="signin-spinner" aria-hidden="true"></span>
				{/if}
			</button>
		{/if}

		<!-- Dev shortcut — dev-only. -->
		{#if DEV_LOGIN_ENABLED && isDev()}
			<button
				class="signin-provider-btn"
				class:is-faded={isFaded}
				class:is-loading={signingIn === 'dev'}
				class:is-onboarding={isOnboarding}
				class:ob-dark={isOnboarding}
				aria-busy={signingIn === 'dev'}
				data-tid={TestId.SignInDev}
				disabled={isBusy}
				onclick={onDev}
				type="button"
			>
				<span class="signin-provider-icon" aria-hidden="true">
					<IconRobot size="18px" />
				</span>
				<span class="signin-provider-label">
					{signingIn === 'dev'
						? t({ locale: $localeStore, key: 'signin.loading.dev' })
						: t({ locale: $localeStore, key: 'signin.provider.dev' })}
				</span>
				{#if signingIn === 'dev'}
					<span class="signin-spinner" aria-hidden="true"></span>
				{/if}
			</button>
		{/if}
	</div>
{/if}
