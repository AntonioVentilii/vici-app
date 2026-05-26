<script lang="ts">
	import { signOut } from '@junobuild/core';
	import { Mail, Fingerprint } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Account settings — sign-in method + email. Two-card layout
	 * matching `AccountSettingsScreen` (`screens.jsx:1594-1671`).
	 *
	 * Auth providers supported here are Internet Identity + Google
	 * (per the locked AGENTS auth scope: Apple / magic-link are
	 * explicitly out of scope). The current-method tile renders the
	 * provider-specific glyph — multi-color Google `G` when an email
	 * is present (Google round-trips email through the SSO), else
	 * the IC fingerprint glyph for Internet Identity / Passkey.
	 *
	 * Email comes from the SSO provider so it's effectively verified
	 * — the green `VERIFIED` chip surfaces beside the address when
	 * one is present. Editing the email is deferred (depends on a
	 * magic-link backend we don't have); the existing pending hint
	 * stays.
	 */

	const email = $derived($userStore.profile?.email ?? '');
	const hasEmail = $derived(email.length > 0);

	let switchingMethod = $state(false);

	const handleSwitchMethod = async () => {
		if (switchingMethod) {
			return;
		}

		switchingMethod = true;

		try {
			await signOut();
			void goto(resolve(PublicPath.SignIn));
		} catch (err) {
			console.warn('Sign-out failed:', err);
		} finally {
			switchingMethod = false;
		}
	};
</script>

<div class="account-page">
	<MobileAppBar
		align="left"
		back={{
			label: t({ locale: $localeStore, key: 'account.back' }),
			onBack: () => void goto(resolve(AppPath.Settings))
		}}
		title={t({ locale: $localeStore, key: 'account.title' })}
	/>

	<p class="account-intro serif-italic">
		{t({ locale: $localeStore, key: 'account.intro' })}
	</p>

	<section class="account-card">
		<h2 class="eyebrow account-section-title">
			{t({ locale: $localeStore, key: 'account.method.eyebrow' })}
		</h2>

		<div class="account-method-row">
			<!--
				Provider-specific glyph in a 44×44 tile. Matches the
				design source's `screens.jsx:1602-1606` which renders an
				Apple / Google / Mail icon based on `currentMethod`. We
				ship II + Google + Passkey + Dev; Google round-trips an
				email through SSO, so an email present means Google;
				otherwise it's an IC-backed identity (II or Passkey)
				and we render the fingerprint glyph.
			-->
			<div class="account-method-icon" class:is-google={hasEmail} aria-hidden="true">
				{#if hasEmail}
					<!-- Multi-color Google G. -->
					<svg height="22" viewBox="0 0 48 48" width="22">
						<path
							d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
							fill="#FFC107"
						/>
						<path
							d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
							fill="#FF3D00"
						/>
						<path
							d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
							fill="#4CAF50"
						/>
						<path
							d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
							fill="#1976D2"
						/>
					</svg>
				{:else}
					<Fingerprint size={22} strokeWidth={1.8} />
				{/if}
			</div>
			<div class="account-method-text">
				<span class="account-method-name">
					{hasEmail
						? t({ locale: $localeStore, key: 'account.method.google' })
						: t({ locale: $localeStore, key: 'account.method.ii' })}
				</span>
				{#if hasEmail}
					<span class="num allcaps account-method-email">{email}</span>
				{/if}
			</div>
		</div>

		<button
			class="account-switch"
			disabled={switchingMethod}
			onclick={handleSwitchMethod}
			type="button"
		>
			{switchingMethod
				? t({ locale: $localeStore, key: 'account.switch.signing_out' })
				: t({ locale: $localeStore, key: 'account.switch.cta' })}
		</button>

		<p class="account-method-hint num allcaps">
			{t({ locale: $localeStore, key: 'account.switch.hint' })}
		</p>
	</section>

	<section class="account-card">
		<h2 class="eyebrow account-section-title">
			{t({ locale: $localeStore, key: 'account.email.eyebrow' })}
		</h2>

		<div class="account-email-row">
			<div class="account-email-icon" aria-hidden="true">
				<Mail size={18} strokeWidth={1.8} />
			</div>
			<div class="account-email-text">
				{#if hasEmail}
					<span class="account-email-value">{email}</span>
					<!--
						Email arrives via the SSO provider, so it's
						effectively verified — surface a green VERIFIED chip
						(matches `screens.jsx:1638`).
					-->
					<span class="account-email-verified allcaps num">
						{t({ locale: $localeStore, key: 'account.email.verified' })}
					</span>
				{:else}
					<span class="account-email-empty">
						{t({ locale: $localeStore, key: 'account.email.empty' })}
					</span>
				{/if}
			</div>
		</div>

		<p class="account-email-hint num allcaps">
			{t({ locale: $localeStore, key: 'account.email.pending' })}
		</p>
	</section>
</div>

<style lang="postcss">
	.account-page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0 1.25rem 6rem;
	}

	.account-intro {
		margin: 0;
		font-size: var(--t-13);
		line-height: 1.5;
		color: var(--text-muted);
	}

	.account-card {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 1rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.account-section-title {
		margin: 0;
		color: var(--text-muted);
	}

	.account-method-row,
	.account-email-row {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}

	.account-method-icon,
	.account-email-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		background: var(--bg-popover);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		color: var(--text-base);
	}

	/* Google sign-in: clean white tile for the multi-color G so the
	   brand mark reads on a dark background too. */
	.account-method-icon.is-google {
		background: #ffffff;
		border-color: var(--border-base);
	}

	.account-method-text,
	.account-email-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
		flex: 1;
	}

	.account-method-name,
	.account-email-value {
		font-size: var(--t-14);
		font-weight: 600;
		color: var(--text-base);
	}

	.account-method-email {
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
	}

	.account-email-empty {
		font-size: var(--t-13);
		font-style: italic;
		color: var(--text-muted);
	}

	/* VERIFIED chip — green mono badge beside the email, matches
	   `screens.jsx:1638`. */
	.account-email-verified {
		align-self: flex-start;
		margin-top: 0.2rem;
		padding: 0.125rem 0.4rem;
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--yes);
		background: color-mix(in srgb, var(--yes) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--yes) 30%, transparent);
		border-radius: var(--r-pill);
	}

	.account-switch {
		appearance: none;
		padding: 0.7rem 1rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 70%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		cursor: pointer;
		transition:
			background 140ms ease,
			border-color 140ms ease;
	}

	.account-switch:hover:not(:disabled) {
		background: color-mix(in srgb, var(--bg-surface) 60%, transparent);
		border-color: color-mix(in srgb, var(--laurel) 30%, var(--border-base));
	}

	.account-switch:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.account-method-hint,
	.account-email-hint {
		margin: 0;
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
		line-height: 1.5;
	}
</style>
