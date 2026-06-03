<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import { isWebAuthnAvailable, signIn, signUp } from '@junobuild/core';
	import { Check, ChevronRight, Mail } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import IconApple from '$lib/components/icons/IconApple.svelte';
	import IconGoogle from '$lib/components/icons/IconGoogle.svelte';
	import IconIc from '$lib/components/icons/IconIC.svelte';
	import IconPasskey from '$lib/components/icons/IconPasskey.svelte';
	import IconRobot from '$lib/components/icons/IconRobot.svelte';
	import { II_MAX_TIME_TO_LIVE_NS } from '$lib/constants/app.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import { isDev, isNotSkylab, isProd } from '$lib/env/app.env';
	import { AppleSignInCancelledError, signInWithApple } from '$lib/services/apple-signin.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		onSuccess?: () => void;
		// `signup` for new accounts (onboarding), `signin` for returning
		// users (the /signin gate and every "sign in to continue" modal).
		// Only the WebAuthn passkey path branches on this: Juno splits
		// `signUp` (create a new passkey, which is the only call that can
		// name it) from `signIn` (authenticate an existing one).
		mode?: 'signin' | 'signup';
		// Onboarding handle, used only to label a freshly-created passkey
		// (`VICI · {handle}`) so it's recognizable in the OS / password
		// manager. Absent → a plain `VICI` label. The user can rename it
		// afterwards from their authenticator.
		handle?: string | null;
	}

	const { onSuccess, mode = 'signin', handle = null }: Props = $props();

	const isSignUp = $derived(mode === 'signup');

	// Friendly display name for a newly-created passkey. Shown by the
	// authenticator's account picker; not required to be unique and freely
	// renamable by the user later.
	const passkeyDisplayName = $derived(
		nonNullish(handle) && handle.trim().length > 0 ? `VICI · ${handle.trim()}` : 'VICI'
	);

	// Provider IDs used to drive per-provider loading + faded-others
	// state. Email is still a placeholder until its back-end ships.
	type ProviderId = 'apple' | 'google' | 'email' | 'ii' | 'passkey' | 'dev';

	// Email renders as a disabled placeholder with a "Coming soon"
	// micro-label until the magic-link back-end ships.
	const EMAIL_ENABLED = false;

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

	// Apple sign-in routes through Internet Identity 2.0's OpenID flow
	// (Juno has no Apple provider), so it bypasses Juno's `signIn()` and
	// drives `@icp-sdk/auth` directly via `signInWithApple`. That persists
	// the delegation to the same store Juno reads but does NOT update
	// Juno's in-memory auth state — so we can't use the shared `startSignIn`
	// (whose success path assumes Juno is already aware of the session).
	// Instead: flush host state via `onSuccess` (in the signup onboarding
	// flow that persists the pending picks to storage), then hard-load Flow.
	// A full document load re-runs `initSatellite()` / `loadAuth()`, which
	// adopts the persisted delegation, fires `onAuthStateChange`, and (via
	// the (app) layout) drains any pending onboarding. The signed-out bounce
	// waits for the auth handshake, so there's no signin flash.
	const onApple = async () => {
		if (signingIn !== null) {
			return;
		}

		signingIn = 'apple';

		try {
			await signInWithApple();
		} catch (err: unknown) {
			if (!(err instanceof AppleSignInCancelledError)) {
				console.error('apple sign-in failed', err);
			}

			signingIn = null;

			return;
		}

		onSuccess?.();

		window.location.assign(resolve(AppPath.Flow));
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

	// Passkey is the one provider where Juno splits create-vs-authenticate.
	// In the sign-up flow we register a NEW passkey (`signUp`) — the only
	// call that accepts a display name, so this is where the `VICI · {handle}`
	// label is set. Everywhere else (the /signin gate, "sign in to continue"
	// modals) we authenticate an EXISTING passkey (`signIn`).
	const onPasskey = () =>
		startSignIn({
			id: 'passkey',
			run: async () => {
				if (isSignUp) {
					await signUp({
						webauthn: {
							options: {
								passkey: { user: { displayName: passkeyDisplayName, name: passkeyDisplayName } }
							}
						}
					});

					return;
				}

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
		<!-- Apple — live via Internet Identity 2.0 OpenID one-click. -->
		{#if APPLE_LOGIN_ENABLED}
			<button
				class="signin-provider-btn is-onboarding ob-dark"
				class:is-faded={isFaded}
				class:is-loading={signingIn === 'apple'}
				aria-busy={signingIn === 'apple'}
				disabled={isBusy}
				onclick={onApple}
				type="button"
			>
				<span class="signin-provider-icon" aria-hidden="true">
					<IconApple size="18px" />
				</span>
				<span class="signin-provider-label">
					{signingIn === 'apple'
						? t({ locale: $localeStore, key: 'signin.loading.apple' })
						: t({ locale: $localeStore, key: 'signin.provider.apple' })}
				</span>
				{#if signingIn === 'apple'}
					<span class="signin-spinner" aria-hidden="true"></span>
				{/if}
			</button>
		{/if}

		<!-- Google — live. -->
		{#if GOOGLE_LOGIN_ENABLED}
			<button
				class="signin-provider-btn is-onboarding ob-cream"
				class:is-faded={isFaded}
				class:is-loading={signingIn === 'google'}
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
					class="signin-provider-btn email is-onboarding ob-faint"
					class:is-faded={isFaded}
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
				class="signin-provider-btn is-onboarding ob-faint"
				class:is-faded={isFaded}
				class:is-loading={signingIn === 'ii'}
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
				class="signin-provider-btn is-onboarding ob-faint"
				class:is-faded={isFaded}
				class:is-loading={signingIn === 'passkey'}
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
						: isSignUp
							? t({ locale: $localeStore, key: 'authn.passkey.create_button' })
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
				class="signin-provider-btn is-onboarding ob-faint"
				class:is-faded={isFaded}
				class:is-loading={signingIn === 'dev'}
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
