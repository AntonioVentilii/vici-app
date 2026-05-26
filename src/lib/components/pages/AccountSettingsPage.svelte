<script lang="ts">
	import { signOut } from '@junobuild/core';
	import { Mail } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Account settings — sign-in method + email. Two-card layout
	 * matching `AccountSettingsScreen`.
	 *
	 * Auth providers supported here are Internet Identity + Google
	 * (per the AGENTS auth scope). The current-method row is a bare
	 * intro — no 44×44 provider-specific glyph tile, no green
	 * VERIFIED chip beside the email. Switching method signs out and
	 * redirects to /signin so the user picks again.
	 *
	 * Editing email is deferred (depends on a magic-link backend we
	 * don't have); the existing pending hint stays.
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
			<div class="account-method-text">
				<span class="account-method-name">
					{t({ locale: $localeStore, key: 'account.method.current' })}
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

	.account-email-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: color-mix(in srgb, var(--bg-surface) 70%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		color: var(--text-base);
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
