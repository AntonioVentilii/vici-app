<script lang="ts">
	import SignInDev from '$lib/components/authn/SignInDev.svelte';
	import SignInGoogle from '$lib/components/authn/SignInGoogle.svelte';
	import SignInII from '$lib/components/authn/SignInII.svelte';
	import SignInPasskey from '$lib/components/authn/SignInPasskey.svelte';
	import { isDev, isNotSkylab, isProd } from '$lib/env/app.env';
	import { localeStore } from '$lib/stores/locale.store';
	import type { ButtonStatus } from '$lib/types/components';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		onSuccess?: () => void;
	}

	const { onSuccess }: Props = $props();

	const prodStatus = $derived<ButtonStatus>(isProd() && isNotSkylab() ? 'enabled' : 'disabled');
</script>

<div class="signin-actions">
	<button
		class="signin-placeholder-provider"
		disabled
		title={t({ locale: $localeStore, key: 'signin.provider.placeholder_title' })}
		type="button"
	>
		<svg aria-hidden="true" viewBox="0 0 24 24">
			<path
				d="M16.365 1.43c0 1.14-.49 2.27-1.29 3.08-.87.9-2.28 1.59-3.43 1.5-.14-1.11.42-2.27 1.22-3.05.88-.88 2.32-1.55 3.5-1.53zM20.5 17.27c-.61 1.4-.9 2.04-1.69 3.28-1.1 1.73-2.66 3.88-4.59 3.9-1.72.02-2.16-1.12-4.49-1.1-2.32.01-2.81 1.12-4.53 1.1-1.93-.02-3.41-1.97-4.51-3.7C-.1 18.1-.18 13.32 1.5 11.1c1.18-1.56 3.05-2.48 4.81-2.48 1.79 0 2.92 1.01 4.4 1.01 1.43 0 2.31-1.01 4.39-1.01 1.57 0 3.24.86 4.42 2.34-3.89 2.13-3.26 7.69 1 6.31z"
			/>
		</svg>
		<span>{t({ locale: $localeStore, key: 'signin.provider.apple' })}</span>
		<small>{t({ locale: $localeStore, key: 'signin.provider.soon' })}</small>
	</button>

	<div class="signin-live-providers">
		<SignInGoogle {onSuccess} />

		<SignInII {onSuccess} status={prodStatus} />

		<SignInPasskey {onSuccess} status={prodStatus} />

		{#if isDev()}
			<SignInDev {onSuccess} />
		{/if}
	</div>

	<div class="signin-divider" aria-hidden="true">
		<span>{t({ locale: $localeStore, key: 'signin.divider' })}</span>
	</div>

	<div class="signin-email-placeholder" aria-disabled="true">
		<label for="signin-email-placeholder">
			{t({ locale: $localeStore, key: 'signin.email.label' })}
		</label>
		<input
			id="signin-email-placeholder"
			autocomplete="email"
			disabled
			inputmode="email"
			placeholder={t({ locale: $localeStore, key: 'signin.email.placeholder' })}
			type="email"
		/>
		<button disabled type="button">
			{t({ locale: $localeStore, key: 'signin.email.cta' })}
		</button>
		<p>{t({ locale: $localeStore, key: 'signin.email.disabled_note' })}</p>
	</div>
</div>

<style lang="postcss">
	.signin-actions {
		display: flex;
		width: 100%;
		flex-direction: column;
		gap: 0.85rem;
	}

	.signin-live-providers {
		display: flex;
		width: 100%;
		flex-direction: column;
		gap: 0.625rem;
	}

	.signin-live-providers :global(> *) {
		width: 100%;
	}

	.signin-live-providers :global(.signin-provider-button) {
		width: 100%;
		justify-content: center;
		border: 1px solid var(--border-base);
		background: color-mix(in srgb, var(--text-base) 4%, transparent);
		color: var(--text-base);
	}

	.signin-live-providers :global(.signin-provider-button:hover) {
		background: color-mix(in srgb, var(--text-base) 7%, transparent);
	}

	.signin-placeholder-provider {
		position: relative;
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: center;
		gap: 0.625rem;
		padding: 0.95rem 1rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--text-base) 4%, transparent);
		color: var(--text-base);
		font: inherit;
		font-weight: 650;
		opacity: 0.62;
	}

	.signin-placeholder-provider svg {
		width: 1.125rem;
		height: 1.125rem;
		flex: 0 0 auto;
		fill: currentColor;
	}

	.signin-placeholder-provider small {
		position: absolute;
		right: 1rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.signin-divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.signin-divider::before,
	.signin-divider::after {
		height: 1px;
		flex: 1;
		background: var(--border-base);
		content: '';
	}

	.signin-email-placeholder {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.signin-email-placeholder label {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.signin-email-placeholder input,
	.signin-email-placeholder button {
		width: 100%;
		border-radius: var(--r-8);
		font: inherit;
	}

	.signin-email-placeholder input {
		padding: 0.9rem 1rem;
		border: 1px solid var(--border-base);
		background: color-mix(in srgb, var(--text-base) 4%, transparent);
		color: var(--text-base);
	}

	.signin-email-placeholder input::placeholder {
		color: var(--text-muted);
	}

	.signin-email-placeholder button {
		padding: 0.9rem 1rem;
		border: 0;
		background: var(--laurel);
		color: var(--ink);
		font-weight: 750;
		opacity: 0.48;
	}

	.signin-email-placeholder p {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-12);
		line-height: var(--leading-normal);
	}
</style>
