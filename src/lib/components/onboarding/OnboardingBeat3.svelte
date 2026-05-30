<script lang="ts">
	import { Gift } from 'lucide-svelte/icons';
	import SignInProviderStack from '$lib/components/authn/SignInProviderStack.svelte';
	import OnboardingStepTracker from '$lib/components/onboarding/OnboardingStepTracker.svelte';
	import { newUserVxpAmountMilestone1BaseUnits } from '$lib/constants/vxp-onboarding.constants';
	import { featuredEvent } from '$lib/derived/featured-event.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';
	import { formatVxpBalance } from '$lib/utils/playground-display.utils';

	/**
	 * Onboarding · Beat 3 — make it count.
	 *
	 * Renders the shared step tracker (`Vici · 3 of 3`), the
	 * "Make it count, @{handle}." headline, a starter-pack strip
	 * framing what an account unlocks, the auth surface, and the ToS
	 * paragraph (led by the play-currency positioning line).
	 *
	 * The starter-pack strip replaces a backing-team summary card: the
	 * first call is already made and confirmed in Beat 1, so at the auth
	 * gate the reward anchor (starter VXP + featured-event market) carries
	 * the "why sign up" on its own — a team card here would be redundant
	 * chrome competing with that anchor.
	 *
	 * The real auth providers (Juno II + Google + Passkey + dev) are
	 * mounted inside `.ob2-auth-buttons` via `SignInProviderStack`
	 * (`.ob2-auth-apple` / `.ob2-auth-google` / `.ob2-auth-email`).
	 */
	interface Props {
		handle: string | null;
		onBack: () => void;
		onComplete: () => void;
		// When `true`, the user is already signed in — render a "Finish
		// setup" CTA instead of the provider stack.
		authenticated?: boolean;
	}

	const { handle, onBack, onComplete, authenticated = false }: Props = $props();

	const event = $derived($featuredEvent);

	// Starter-pack VXP — sourced from the real registration milestone
	// grant (10% of the new-user reserve) rather than a hardcoded
	// literal, so the strip stays in lock-step with the economy config.
	const starterVxp = $derived(formatVxpBalance({ value: newUserVxpAmountMilestone1BaseUnits() }));
</script>

<div class="ob2-beat ob2-beat-3">
	<OnboardingStepTracker step={3} />

	<h1 class="ob2-h1">
		{#if handle}
			{t({ locale: $localeStore, key: 'onboarding.beat3.title_prefix' })}<span
				class="serif-italic acc">@{handle}</span
			>{t({ locale: $localeStore, key: 'onboarding.beat3.title_suffix' })}
		{:else}
			{t({ locale: $localeStore, key: 'onboarding.beat3.title_plain' })}
		{/if}
	</h1>

	<p class="ob2-sub">{t({ locale: $localeStore, key: 'onboarding.beat3.sub' })}</p>

	<!-- Starter pack — what creating an account unlocks. Framed as
	     gameplay currency, never money (positioning contract). -->
	<div class="ob2-summary ob2-summary-starter">
		<div class="ob2-summary-row">
			<span class="ob2-summary-flag ob2-summary-flag-starter">
				<Gift size={16} strokeWidth={1.7} />
			</span>
			<div>
				<div class="ob2-summary-q">
					{t({ locale: $localeStore, key: 'onboarding.beat3.starter_title' })}
				</div>
				<div class="ob2-summary-meta">
					{t({
						locale: $localeStore,
						key: 'onboarding.beat3.starter_meta',
						params: {
							vxp: starterVxp,
							event: event.brandedTitle ?? event.shortTitle ?? event.title
						}
					})}
				</div>
			</div>
		</div>
	</div>

	<div class="ob2-auth-buttons">
		{#if authenticated}
			<button class="ob2-btn-primary" onclick={onComplete} type="button">
				{t({ locale: $localeStore, key: 'onboarding.beat3.finish_cta' })}
			</button>
		{:else}
			<SignInProviderStack onSuccess={onComplete} />
		{/if}
	</div>

	{#if !authenticated}
		<div class="ob2-tos">
			<div class="ob2-tos-play">
				{t({ locale: $localeStore, key: 'onboarding.beat3.tos.play_currency' })}
			</div>
			{t({ locale: $localeStore, key: 'onboarding.beat3.tos.prefix' })}
			<a href="/info/terms" rel="noopener" target="_blank">
				{t({ locale: $localeStore, key: 'onboarding.beat3.tos.terms' })}
			</a>
			{t({ locale: $localeStore, key: 'onboarding.beat3.tos.and' })}
			<a href="/info/privacy" rel="noopener" target="_blank">
				{t({ locale: $localeStore, key: 'onboarding.beat3.tos.privacy' })}
			</a>{t({ locale: $localeStore, key: 'onboarding.beat3.tos.suffix' })}
			<span class="serif-italic">
				{t({ locale: $localeStore, key: 'onboarding.beat3.tos.tail' })}
			</span>
		</div>
	{/if}

	<button style:margin-top="8px" class="ob2-skip-link" onclick={onBack} type="button">
		{t({ locale: $localeStore, key: 'onboarding.beat3.back' })}
	</button>
</div>
