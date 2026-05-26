<script lang="ts">
	import OnboardingBeat1 from '$lib/components/onboarding/OnboardingBeat1.svelte';
	import OnboardingBeat1Card from '$lib/components/onboarding/OnboardingBeat1Card.svelte';
	import OnboardingBeat2 from '$lib/components/onboarding/OnboardingBeat2.svelte';
	import OnboardingBeat3 from '$lib/components/onboarding/OnboardingBeat3.svelte';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Onboarding orchestrator — the 3-beat sequence wired up.
	 *
	 * Beat 1 splits into two micro-phases:
	 *
	 *   1.a · team picker            (`pick` selects, `skip` advances null)
	 *   1.b · derived first call     (`commit` advances side, "change team" returns to 1.a)
	 *   2   · handle picker          (`advance` advances handle | null, `back` returns to 1.b)
	 *   3   · auth — locks the record. Final `onComplete` is bubbled to the parent.
	 *
	 * Each beat is a standalone component; the orchestrator owns the
	 * cross-beat state and decides which to render.
	 */
	interface Props {
		// Fires after Beat 3's SignInActions resolves. The parent route
		// owns the post-auth handoff (persisting team/side/handle into
		// the profile, routing into the app).
		onComplete: (result: {
			participantId: string | null;
			side: 'YES' | 'NO' | null;
			handle: string | null;
		}) => void;
	}

	const { onComplete }: Props = $props();

	type Beat = '1a' | '1b' | '2' | '3';

	let beat: Beat = $state('1a');
	let participantId: string | null = $state(null);
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

<div class="ob2-orchestrator">
	<a class="ob2-switch-link" href={PublicPath.SignIn}>
		{t({ locale: $localeStore, key: 'onboarding.switch.prefix' })}
		<span class="ob2-switch-link-accent">
			{t({ locale: $localeStore, key: 'onboarding.switch.signin' })}
		</span>
	</a>

	{#if beat === '1a'}
		<OnboardingBeat1 onPick={handlePick} />
	{:else if beat === '1b'}
		<OnboardingBeat1Card onChangeTeam={handleChangeTeam} onCommit={handleCommit} {participantId} />
	{:else if beat === '2'}
		<OnboardingBeat2 onAdvance={handleHandle} onBack={handleHandleBack} {participantId} />
	{:else}
		<OnboardingBeat3
			{handle}
			onBack={handleAuthBack}
			onComplete={handleAuthComplete}
			{participantId}
			{side}
		/>
	{/if}
</div>

<style lang="postcss">
	.ob2-orchestrator {
		display: flex;
		flex-direction: column;
		min-height: 100%;
	}

	.ob2-switch-link {
		align-self: flex-end;
		padding: 0.75rem 1rem 0.25rem;
		font-size: var(--t-13);
		color: var(--text-muted);
		text-decoration: none;
		transition: color 140ms ease;
	}

	.ob2-switch-link:hover {
		color: var(--text-base);
	}

	.ob2-switch-link-accent {
		color: var(--laurel);
		text-decoration: underline;
		text-underline-offset: 0.18em;
	}
</style>
