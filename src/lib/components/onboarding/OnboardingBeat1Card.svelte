<script lang="ts">
	import FlowCard from '$lib/components/market/FlowCard.svelte';
	import FlowCoach from '$lib/components/onboarding/FlowCoach.svelte';
	import OnboardingStepTracker from '$lib/components/onboarding/OnboardingStepTracker.svelte';
	import CountryFlag from '$lib/components/ui/CountryFlag.svelte';
	import { DAY_IN_MS } from '$lib/constants/app.constants';
	import { VXP_DEFAULT_STAKE } from '$lib/constants/vxp-economy.constants';
	import { featuredEvent } from '$lib/derived/featured-event.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import type { FeaturedEventParticipant } from '$lib/types/featured-event';
	import type { FlowAction } from '$lib/types/market';
	import { haptic } from '$lib/utils/haptics.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { buildOnboardingFirstCallMarket } from '$lib/utils/onboarding-market.utils';

	/**
	 * Onboarding · Beat 1.b — derived first-call card.
	 *
	 * Mounts the real `FlowCard` in `guided` mode so the first call is
	 * pixel-identical to the in-product deck: same header, artwork band,
	 * probability split, and footer — but flip is inert and the swipe-up
	 * SKIP is suppressed, so the rehearsal can only commit a YES or NO.
	 * The `FlowCoach` overlay rides above it with the onboarding gesture
	 * hint.
	 *
	 * Two question modes (mirrored from the team-pick branch):
	 *   - Picked team → advancement market ("Will X make the round of
	 *     16?"). Soft predict beat — the user is asked about *their*
	 *     team's run, not who wins it all.
	 *   - Skipped     → the first favourite's winner market ("Will
	 *     Brazil win the World Cup?").
	 */
	interface Props {
		// `null` selects the skip path (no team picked); otherwise a
		// participant id (ISO-3166 alpha-2 for the WC).
		participantId: string | null;
		onCommit: (side: 'YES' | 'NO') => void;
		onChangeTeam: () => void;
	}

	const { participantId, onCommit, onChangeTeam }: Props = $props();

	const event = $derived($featuredEvent);

	const kickoffDays = $derived(
		Math.max(0, Math.ceil((event.kickoffAt_ms - Date.now()) / DAY_IN_MS))
	);

	const picked: FeaturedEventParticipant | undefined = $derived(
		participantId === null ? undefined : event.participants.find((p) => p.id === participantId)
	);

	const fallbackFavourite: FeaturedEventParticipant | undefined = $derived(
		event.participants.find((p) => p.id === event.favouriteIds[0])
	);

	// The participant the card frames — the picked team, or the first
	// favourite on the skip path so the winner market still has a subject.
	const subject: FeaturedEventParticipant | undefined = $derived(picked ?? fallbackFavourite);

	// Full synthetic `Market` the guided FlowCard binds to. Built off the
	// featured-event fixture (onboarding runs pre-auth, before any market
	// hydrates).
	const market = $derived(buildOnboardingFirstCallMarket({ event, participant: picked }));

	// Editorial sub-line under the question — "Backing Brazil". Mirrors
	// the in-deck subtitle slot rather than leaving FlowCard to derive a
	// fallback, so the card reinforces the team identity just chosen.
	const subtitle = $derived(
		subject
			? t({
					locale: $localeStore,
					key: 'onboarding.beat1b.card_context',
					params: { team: subject.name }
				})
			: undefined
	);

	const handleAction = (action: FlowAction) => {
		// Guided mode suppresses SKIP, so only YES / NO reach here; guard
		// anyway so a stray action can't advance with a non-binary side.
		if (action !== 'YES' && action !== 'NO') {
			return;
		}

		// Firm tap on first-call commit.
		haptic('firm-tap');
		onCommit(action);
	};
</script>

<div class="ob2-beat ob2-beat-1">
	<OnboardingStepTracker step={1} />

	<div class="ob2-wc-eyebrow">
		<span class="ob2-wc-tag">{event.badgeTitle ?? event.title}</span>
		<span class="ob2-wc-countdown">
			· {t({
				locale: $localeStore,
				key: 'onboarding.beat1.kickoff_days',
				params: { days: kickoffDays }
			})}
		</span>
	</div>

	<h1 class="ob2-h1">{t({ locale: $localeStore, key: 'onboarding.beat1b.headline' })}</h1>
	{#if picked}
		<p class="ob2-sub">
			<CountryFlag class="ob2-picked-flag" countryCode={picked.id} />
			{t({ locale: $localeStore, key: 'onboarding.beat1b.backing_prefix' })}
			<b style:color={picked.color ?? 'var(--laurel)'}>{picked.name}</b>
			· {t({ locale: $localeStore, key: 'onboarding.beat1b.backing_sub' })}
			<button class="ob2-change-team" onclick={onChangeTeam} type="button">
				{t({ locale: $localeStore, key: 'onboarding.beat1b.change_team' })}
			</button>
		</p>
	{:else}
		<p class="ob2-sub">
			{t({
				locale: $localeStore,
				key: 'onboarding.beat1b.skip_sub',
				params: { team: fallbackFavourite?.name ?? '' }
			})}
		</p>
	{/if}

	<div class="ob2-card-stage">
		<FlowCard
			category="wc"
			guided
			{market}
			onAction={handleAction}
			signedIn={false}
			{subtitle}
			tradeAmount={String(VXP_DEFAULT_STAKE)}
		/>
		<FlowCoach surface="onboarding" />
	</div>
</div>

<style lang="postcss">
	/* The guided FlowCard fills the stage; it's absolutely-positioned via
	   its own root, so the stage just needs to be the positioning context
	   (the `.ob2-card-stage` envelope itself lives in app.css). The coach
	   overlay sits above the card within the same stage. */
	.ob2-card-stage :global(.flow-card-root) {
		position: absolute;
		inset: 0;
	}
</style>
