<script lang="ts">
	import SignInProviderStack from '$lib/components/authn/SignInProviderStack.svelte';
	import CountryFlag from '$lib/components/ui/CountryFlag.svelte';
	import { featuredEvent } from '$lib/derived/featured-event.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Onboarding · Beat 3 — lock in the record.
	 *
	 * Verbatim port of `Beat3Auth` from `onboarding-v2.jsx` (lines
	 * 280-346). Renders the `BeatV2Header` (progress dots + "BEAT 3 OF
	 * 3"), the narrative subtitle, the affiliation summary card, the
	 * auth surface, the ToS paragraph, and the "Back to handle" link.
	 *
	 * The real auth providers (Juno II + Google + Passkey + dev) are
	 * mounted inside `.ob2-auth-buttons` via `SignInProviderStack` —
	 * the wiring is real, the styling matches the prototype's
	 * `.ob2-auth-apple` / `.ob2-auth-google` / `.ob2-auth-email`
	 * affordances.
	 */
	interface Props {
		participantId: string | null;
		handle: string | null;
		side: 'YES' | 'NO' | null;
		onBack: () => void;
		onComplete: () => void;
		// When `true`, the user is already signed in — render a "Finish
		// setup" CTA instead of the provider stack.
		authenticated?: boolean;
	}

	const {
		participantId,
		handle,
		side,
		onBack,
		onComplete,
		authenticated = false
	}: Props = $props();

	const event = $derived($featuredEvent);
	const team = $derived(
		participantId === null ? undefined : event.participants.find((p) => p.id === participantId)
	);

	const resolvesLabel = $derived(
		new Intl.DateTimeFormat($localeStore, { month: 'short', day: 'numeric' }).format(
			new Date(event.finalAt_ms)
		)
	);
</script>

<div class="ob2-beat ob2-beat-3">
	<div class="ob2-header">
		<span class="ob2-progress">
			<span class="ob2-progress-dot filled"></span>
			<span class="ob2-progress-dot filled"></span>
			<span class="ob2-progress-dot filled"></span>
		</span>
		<span class="ob2-step-label">
			{t({
				locale: $localeStore,
				key: 'onboarding.beat_label',
				params: { current: 3, total: 3 }
			})}
		</span>
	</div>

	<h1 class="ob2-h1">{t({ locale: $localeStore, key: 'onboarding.beat3.title' })}</h1>

	<p class="ob2-sub">
		<span class="serif-italic acc">
			@{handle ?? t({ locale: $localeStore, key: 'onboarding.beat3.handle_placeholder' })}
		</span>,
		{t({
			locale: $localeStore,
			key: 'onboarding.beat3.sub',
			params: { resolves: resolvesLabel }
		})}
	</p>

	{#if team}
		{@const teamColor = team.color ?? 'var(--laurel)'}
		<div class="ob2-summary">
			<div class="ob2-summary-row">
				<span style:background="{teamColor}22" style:color={teamColor} class="ob2-summary-flag">
					<CountryFlag class="ob2-summary-flag-img" countryCode={team.id} />
				</span>
				<div>
					<div class="ob2-summary-q">
						{t({
							locale: $localeStore,
							key: 'onboarding.beat3.summary_backing',
							params: { team: team.name }
						})}
					</div>
					<div class="ob2-summary-meta">
						{#if side !== null}
							{t({
								locale: $localeStore,
								key: 'onboarding.beat3.summary_meta_side',
								params: { side, event: event.title, resolves: resolvesLabel }
							})}
						{:else}
							{t({
								locale: $localeStore,
								key: 'onboarding.beat3.summary_meta',
								params: { event: event.title, resolves: resolvesLabel }
							})}
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}

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
