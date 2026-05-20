<script lang="ts">
	import { onMount } from 'svelte';
	import FlameChar from '$lib/components/characters/FlameChar.svelte';
	import OracleChar from '$lib/components/characters/OracleChar.svelte';
	import TricksterChar from '$lib/components/characters/TricksterChar.svelte';
	import ViciChar from '$lib/components/characters/ViciChar.svelte';
	import type { MotionBeatPayload } from '$lib/utils/motion-engine.utils';

	interface Props {
		beat: MotionBeatPayload;
		bonusXp?: number;
		onDone: () => void;
	}

	const { beat, bonusXp = 0, onDone }: Props = $props();

	onMount(() => {
		const total = beat.duration_ms + 500;
		const id = setTimeout(onDone, total);

		return () => clearTimeout(id);
	});
</script>

<div class="motion-beat" class:is-hard={beat.hardPause} aria-live="polite" role="status">
	<div class="motion-beat-inner">
		{#if beat.character === 'oracle'}
			<OracleChar animate size={48} />
		{:else if beat.character === 'trickster'}
			<TricksterChar animate lightning size={48} />
		{:else if beat.character === 'flame'}
			<FlameChar animate size={48} stage={beat.flameStage ?? 'flame'} />
		{:else}
			<ViciChar mood="happy" size={48} />
		{/if}

		<div class="motion-beat-copy">
			{#if beat.badge}
				<span class="motion-beat-badge allcaps">{beat.badge}</span>
			{/if}
			{#if beat.copy}
				<p class="motion-beat-line serif-italic">{beat.copy}</p>
			{/if}
			{#if bonusXp > 0}
				<p class="motion-beat-xp num">+{bonusXp} XP</p>
			{/if}
		</div>
	</div>
</div>

<style lang="postcss">
	.motion-beat {
		position: absolute;
		inset: 0;
		z-index: 40;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding: 1.5rem 1.25rem 5.5rem;
		pointer-events: none;
	}

	.motion-beat.is-hard {
		background: rgba(14, 13, 11, 0.42);
	}

	.motion-beat-inner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: var(--r-12);
		border: 1px solid var(--border-strong);
		background: var(--bg-popover);
		box-shadow: var(--shadow-card);
		max-width: 100%;
	}

	.motion-beat-copy {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.motion-beat-badge {
		font-size: 10px;
		color: var(--laurel);
		letter-spacing: var(--tracking-allcaps);
	}

	.motion-beat-line {
		margin: 0;
		font-size: 1rem;
		line-height: var(--leading-snug);
		color: var(--parchment);
	}

	.motion-beat-xp {
		margin: 0;
		font-size: var(--t-13);
		color: var(--laurel);
		font-weight: 600;
	}
</style>
