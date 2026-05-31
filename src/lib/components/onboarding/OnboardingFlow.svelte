<script lang="ts">
	import OnboardingBeat1 from '$lib/components/onboarding/OnboardingBeat1.svelte';
	import OnboardingBeat1Card from '$lib/components/onboarding/OnboardingBeat1Card.svelte';
	import OnboardingBeat2 from '$lib/components/onboarding/OnboardingBeat2.svelte';
	import OnboardingBeat3 from '$lib/components/onboarding/OnboardingBeat3.svelte';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { featuredEvent } from '$lib/derived/featured-event.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Onboarding orchestrator. Outer `.ob.ob-v2` envelope, inline
	 * "Already a member? Sign in" affordance, and a `.ob-wrap >
	 * .ob-body-wrap` content slot that swaps the active beat.
	 *
	 * Beat 1 splits into two micro-phases:
	 *
	 *   1.a · team picker            (`pick` selects, `skip` advances null)
	 *   1.b · derived first call     (`commit` advances side, "change team" returns to 1.a)
	 *   2   · handle picker          (`advance` advances handle | null, `back` returns to 1.b)
	 *   3   · auth — locks the record. Final `onComplete` is bubbled to the parent.
	 */
	interface Props {
		// Fires after Beat 3's auth provider stack resolves.
		onComplete: (result: {
			participantId: string | null;
			side: 'YES' | 'NO' | null;
			handle: string | null;
		}) => void;
		// True when the user is already signed in (post-signin onboarding path).
		authenticated?: boolean;
		// Deep-link preselect (e.g. tapping a landing favourite → `/signup?team=BR`).
		// A featured-event participant id; when it resolves to a current
		// participant the flow opens straight on Beat 1b (that team's first
		// call) instead of the team picker. An unknown/absent value falls
		// through to the normal picker — no preselect.
		initialParticipantId?: string;
	}

	const { onComplete, authenticated = false, initialParticipantId }: Props = $props();

	type Beat = '1a' | '1b' | '2' | '3';

	// Resolve the preselect once, at init. Only honour it if it maps to a
	// real participant in the current featured event; otherwise behave as
	// if no team was preselected. Read non-reactively — onboarding owns
	// `beat`/`participantId` as local state from here on, so a later prop
	// change must not yank the user back to Beat 1b.
	const presetParticipantId: string | null = (() => {
		if (initialParticipantId === undefined) {
			return null;
		}

		const exists = $featuredEvent.participants.some((p) => p.id === initialParticipantId);

		return exists ? initialParticipantId : null;
	})();

	let beat: Beat = $state(presetParticipantId === null ? '1a' : '1b');
	let participantId: string | null = $state(presetParticipantId);
	let side: 'YES' | 'NO' | null = $state(null);
	let handle: string | null = $state(null);

	const handlePick = (id: string | null) => {
		participantId = id;
		beat = '1b';
	};

	const handleCommit = (committedSide: 'YES' | 'NO') => {
		side = committedSide;
		beat = '2';
	};

	const handleChangeTeam = () => {
		participantId = null;
		side = null;
		beat = '1a';
	};

	const handleHandle = (next: string | null) => {
		handle = next;
		beat = '3';
	};

	const handleHandleBack = () => {
		beat = '1b';
	};

	const handleAuthBack = () => {
		beat = '2';
	};

	const handleAuthComplete = () => {
		onComplete({ participantId, side, handle });
	};
</script>

<div class="ob ob-v2">
	{#if !authenticated}
		<a class="ob-switch-link" aria-label="Sign in" href={PublicPath.SignIn}>
			{t({ locale: $localeStore, key: 'onboarding.switch.prefix' })}
			<span class="acc">{t({ locale: $localeStore, key: 'onboarding.switch.signin' })}</span>
		</a>
	{/if}

	<div class="ob-wrap">
		<div class="ob-body-wrap">
			{#if beat === '1a'}
				<OnboardingBeat1 onPick={handlePick} />
			{:else if beat === '1b'}
				<OnboardingBeat1Card
					onChangeTeam={handleChangeTeam}
					onCommit={handleCommit}
					{participantId}
					showCoach
				/>
			{:else if beat === '2'}
				<OnboardingBeat2 onAdvance={handleHandle} onBack={handleHandleBack} {participantId} />
			{:else}
				<OnboardingBeat3
					{authenticated}
					{handle}
					onBack={handleAuthBack}
					onComplete={handleAuthComplete}
				/>
			{/if}
		</div>
	</div>
</div>
