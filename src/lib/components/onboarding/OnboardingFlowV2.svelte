<script lang="ts">
	import OnboardingV2Beat1 from '$lib/components/onboarding/OnboardingV2Beat1.svelte';
	import OnboardingV2Beat1Card from '$lib/components/onboarding/OnboardingV2Beat1Card.svelte';
	import OnboardingV2Beat2 from '$lib/components/onboarding/OnboardingV2Beat2.svelte';
	import OnboardingV2Beat3 from '$lib/components/onboarding/OnboardingV2Beat3.svelte';

	/**
	 * Onboarding V2 orchestrator — the 3-beat sequence wired up.
	 *
	 * Beat 1 splits into two micro-phases per the V1.2 prototype:
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
	{#if beat === '1a'}
		<OnboardingV2Beat1 onPick={handlePick} />
	{:else if beat === '1b'}
		<OnboardingV2Beat1Card
			onChangeTeam={handleChangeTeam}
			onCommit={handleCommit}
			{participantId}
		/>
	{:else if beat === '2'}
		<OnboardingV2Beat2 onAdvance={handleHandle} onBack={handleHandleBack} {participantId} />
	{:else}
		<OnboardingV2Beat3
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
</style>
