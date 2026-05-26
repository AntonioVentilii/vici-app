<script lang="ts">
	import { signIn } from '@junobuild/core';
	import { Check, ChevronRight, Mail } from 'lucide-svelte';
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
	}

	const { onSuccess }: Props = $props();

	// Provider IDs used to drive per-provider loading + faded-others
	// state. Apple + email are placeholders until we ship the
	// corresponding back-end providers.
	type ProviderId = 'apple' | 'google' | 'email' | 'ii' | 'passkey' | 'dev';

	// Auth surfaces that are wired to a live back-end provider. Apple
	// + email render as disabled placeholders with a "Coming soon"
	// micro-label until we ship them.
	const EMAIL_ENABLED = false;
	const APPLE_ENABLED = false;

	let signingIn = $state<ProviderId | null>(null);
	let emailOpen = $state(false);
	let email = $state('');
	let phase = $state<'idle' | 'sent'>('idle');

	const productionAvailable = $derived(isProd() && isNotSkylab());
	const emailValid = $derived(/\S+@\S+\.\S+/.test(email));
	const isBusy = $derived(signingIn !== null);
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
			<Check size={22} strokeWidth={2.4} />
		</div>
		<h2 class="signin-sent-title">{t({ locale: $localeStore, key: 'signin.sent.title' })}</h2>
		<p class="signin-sent-body">
			{t({ locale: $localeStore, key: 'signin.sent.body.prefix' })}
			<span class="num">{email}</span>{t({ locale: $localeStore, key: 'signin.sent.body.suffix' })}
		</p>
		<button class="signin-sent-continue" onclick={onSentContinue} type="button">
			<span>{t({ locale: $localeStore, key: 'signin.sent.continue' })}</span>
			<ChevronRight aria-hidden="true" size={16} strokeWidth={2.2} />
		</button>
		<button class="signin-sent-link" onclick={onEmailReset} type="button">
			{t({ locale: $localeStore, key: 'signin.sent.use_different' })}
		</button>
	</div>
{:else}
	<div class="signin-stack" class:is-email-open={emailOpen}>
		<!-- Apple — disabled placeholder until backend ships. -->
		<button
			class="signin-provider-btn apple"
			class:is-faded={isFaded}
			class:is-loading={signingIn === 'apple'}
			aria-label={t({ locale: $localeStore, key: 'signin.provider.apple' })}
			disabled={!APPLE_ENABLED || isBusy}
			title={t({ locale: $localeStore, key: 'signin.provider.placeholder_title' })}
			type="button"
		>
			<span class="signin-provider-icon" aria-hidden="true">
				{#if signingIn === 'apple'}
					<span class="signin-spinner"></span>
				{:else}
					<svg fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
						<path
							d="M16.365 1.43c0 1.14-.49 2.27-1.29 3.08-.87.9-2.28 1.59-3.43 1.5-.14-1.11.42-2.27 1.22-3.05.88-.88 2.32-1.55 3.5-1.53zM20.5 17.27c-.61 1.4-.9 2.04-1.69 3.28-1.1 1.73-2.66 3.88-4.59 3.9-1.72.02-2.16-1.12-4.49-1.1-2.32.01-2.81 1.12-4.53 1.1-1.93-.02-3.41-1.97-4.51-3.7C-.1 18.1-.18 13.32 1.5 11.1c1.18-1.56 3.05-2.48 4.81-2.48 1.79 0 2.92 1.01 4.4 1.01 1.43 0 2.31-1.01 4.39-1.01 1.57 0 3.24.86 4.42 2.34-3.89 2.13-3.26 7.69 1 6.31z"
						/>
					</svg>
				{/if}
			</span>
			<span class="signin-provider-label">
				{signingIn === 'apple'
					? t({ locale: $localeStore, key: 'signin.loading.apple' })
					: t({ locale: $localeStore, key: 'signin.provider.apple' })}
			</span>
			{#if !APPLE_ENABLED}
				<small class="signin-provider-soon">
					{t({ locale: $localeStore, key: 'signin.provider.soon' })}
				</small>
			{/if}
		</button>

		<!-- Google — live. -->
		<button
			class="signin-provider-btn google"
			class:is-faded={isFaded}
			class:is-loading={signingIn === 'google'}
			disabled={isBusy}
			onclick={onGoogle}
			type="button"
		>
			<span class="signin-provider-icon" aria-hidden="true">
				{#if signingIn === 'google'}
					<span class="signin-spinner"></span>
				{:else}
					<IconGoogle size="18px" />
				{/if}
			</span>
			<span class="signin-provider-label">
				{signingIn === 'google'
					? t({ locale: $localeStore, key: 'signin.loading.google' })
					: t({ locale: $localeStore, key: 'signin.provider.google' })}
			</span>
		</button>

		<!-- Email — disabled placeholder + progressive disclosure. -->
		{#if !emailOpen}
			<button
				class="signin-provider-btn email"
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
					<input
						class="signin-email-input num"
						autocapitalize="off"
						autocomplete="email"
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
					<span>
						{signingIn === 'email'
							? t({ locale: $localeStore, key: 'signin.loading.email' })
							: t({ locale: $localeStore, key: 'signin.email.cta' })}
					</span>
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

		<!-- Internet Identity — production-need (C-8 keep). -->
		<button
			class="signin-provider-btn"
			class:is-faded={isFaded}
			class:is-loading={signingIn === 'ii'}
			disabled={isBusy || !productionAvailable}
			onclick={onIi}
			type="button"
		>
			<span class="signin-provider-icon" aria-hidden="true">
				{#if signingIn === 'ii'}
					<span class="signin-spinner"></span>
				{:else}
					<IconIc size="18px" />
				{/if}
			</span>
			<span class="signin-provider-label">
				{signingIn === 'ii'
					? t({ locale: $localeStore, key: 'signin.loading.ii' })
					: t({ locale: $localeStore, key: 'authn.signin_with.ii' })}
			</span>
		</button>

		<!-- Passkey — production-need (C-8 keep). -->
		<button
			class="signin-provider-btn"
			class:is-faded={isFaded}
			class:is-loading={signingIn === 'passkey'}
			disabled={isBusy || !productionAvailable}
			onclick={onPasskey}
			type="button"
		>
			<span class="signin-provider-icon" aria-hidden="true">
				{#if signingIn === 'passkey'}
					<span class="signin-spinner"></span>
				{:else}
					<IconPasskey size="18px" />
				{/if}
			</span>
			<span class="signin-provider-label">
				{signingIn === 'passkey'
					? t({ locale: $localeStore, key: 'signin.loading.passkey' })
					: t({ locale: $localeStore, key: 'authn.passkey.signin_button' })}
			</span>
		</button>

		<!-- Dev shortcut — dev-only. -->
		{#if isDev()}
			<button
				class="signin-provider-btn"
				class:is-faded={isFaded}
				class:is-loading={signingIn === 'dev'}
				data-tid={TestId.SignInDev}
				disabled={isBusy}
				onclick={onDev}
				type="button"
			>
				<span class="signin-provider-icon" aria-hidden="true">
					{#if signingIn === 'dev'}
						<span class="signin-spinner"></span>
					{:else}
						<IconRobot size="18px" />
					{/if}
				</span>
				<span class="signin-provider-label">
					{signingIn === 'dev'
						? t({ locale: $localeStore, key: 'signin.loading.dev' })
						: t({ locale: $localeStore, key: 'signin.provider.dev' })}
				</span>
			</button>
		{/if}
	</div>
{/if}

<style lang="postcss">
	.signin-stack {
		display: flex;
		width: 100%;
		flex-direction: column;
		gap: 0.5rem;
	}

	.signin-provider-btn {
		position: relative;
		display: flex;
		width: 100%;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-surface);
		color: var(--text-base);
		font: inherit;
		font-size: var(--t-15);
		font-weight: 600;
		cursor: pointer;
		transition:
			opacity var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici),
			background var(--d-hover) var(--ease-vici),
			transform 80ms var(--ease-vici);
	}

	.signin-provider-btn:hover:not(:disabled) {
		border-color: var(--border-strong);
		background: color-mix(in srgb, var(--text-base) 6%, transparent);
	}

	.signin-provider-btn:active:not(:disabled) {
		transform: scale(0.99);
	}

	.signin-provider-btn:disabled {
		cursor: not-allowed;
	}

	.signin-provider-btn.is-faded {
		opacity: 0.4;
	}

	.signin-provider-btn.is-loading {
		opacity: 0.75;
	}

	.signin-provider-btn.email {
		background: color-mix(in srgb, var(--laurel) 4%, transparent);
		border-color: color-mix(in srgb, var(--laurel) 22%, transparent);
		color: var(--laurel);
	}

	.signin-provider-icon {
		display: inline-flex;
		width: 1.5rem;
		height: 1.5rem;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
	}

	/* Per-provider loading spinner — replaces the brand icon while the
	   sign-in is in flight, mirroring the prototype's `.signin-spinner`
	   ring. Drives `signin-spin` (defined in app.css). */
	.signin-spinner {
		width: 14px;
		height: 14px;
		border: 2px solid color-mix(in srgb, var(--text-base) 20%, transparent);
		border-top-color: var(--color-accent);
		border-radius: 50%;
		animation: signin-spin 720ms linear infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.signin-spinner {
			animation: none;
		}
	}

	.signin-provider-label {
		flex: 1;
		padding-right: 1.5rem;
		text-align: center;
	}

	.signin-provider-soon {
		position: absolute;
		right: 1rem;
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.signin-email-inline {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		margin: 0.25rem 0 0.25rem;
	}

	.signin-email-row {
		position: relative;
		display: flex;
		align-items: center;
	}

	.signin-email-icon {
		position: absolute;
		left: 0.875rem;
		display: inline-flex;
		color: var(--text-muted);
		pointer-events: none;
	}

	.signin-email-input {
		width: 100%;
		padding: 0.875rem 0.875rem 0.875rem 2.625rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--r-12);
		background: var(--bg-surface);
		color: var(--text-base);
		font-family: var(--font-mono);
		font-size: var(--t-14);
		outline: 0;
		transition: border-color 160ms var(--ease-vici);
	}

	.signin-email-input:focus {
		border-color: var(--laurel);
	}

	.signin-email-input:disabled {
		opacity: 0.62;
	}

	.signin-email-input::placeholder {
		color: var(--text-muted);
	}

	.signin-email-submit {
		display: inline-flex;
		width: 100%;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.875rem 1rem;
		border: 0;
		border-radius: var(--r-12);
		background: var(--laurel);
		color: var(--ink);
		font: inherit;
		font-weight: 750;
		cursor: pointer;
		transition: opacity var(--d-hover) var(--ease-vici);
	}

	.signin-email-submit:disabled {
		opacity: 0.48;
		cursor: not-allowed;
	}

	.signin-fineprint {
		margin: 0.25rem 0 0;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.04em;
		line-height: var(--leading-normal);
		text-align: center;
	}

	.signin-sent {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.5rem 0 0.25rem;
	}

	.signin-sent-mark {
		display: inline-flex;
		width: 2.75rem;
		height: 2.75rem;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: color-mix(in srgb, var(--yes) 12%, transparent);
		color: var(--yes);
		margin-bottom: 0.25rem;
	}

	.signin-sent-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-22);
		font-weight: 600;
		letter-spacing: var(--tracking-snug);
		color: var(--text-base);
	}

	.signin-sent-body {
		margin: 0 0 0.5rem;
		font-size: var(--t-14);
		line-height: var(--leading-relaxed);
		color: var(--text-muted);
	}

	.signin-sent-body .num {
		color: var(--text-base);
	}

	.signin-sent-continue {
		display: inline-flex;
		width: 100%;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.875rem 1rem;
		border: 0;
		border-radius: var(--r-12);
		background: var(--laurel);
		color: var(--ink);
		font: inherit;
		font-weight: 750;
		cursor: pointer;
	}

	.signin-sent-link {
		align-self: center;
		border: 0;
		background: transparent;
		padding: 0.1rem 0;
		color: var(--laurel);
		font: inherit;
		font-size: var(--t-13);
		text-decoration: underline;
		text-decoration-color: var(--parchment-faint);
		text-underline-offset: 0.2em;
		cursor: pointer;
		transition: text-decoration-color var(--d-hover) var(--ease-vici);
	}

	.signin-sent-link:hover {
		text-decoration-color: var(--laurel);
	}
</style>
