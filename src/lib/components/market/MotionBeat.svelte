<script lang="ts">
	import { onMount } from 'svelte';
	import FlameChar from '$lib/components/characters/FlameChar.svelte';
	import OracleChar from '$lib/components/characters/OracleChar.svelte';
	import TricksterChar from '$lib/components/characters/TricksterChar.svelte';
	import ViciChar from '$lib/components/characters/ViciChar.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';
	import type { MotionBeatPayload } from '$lib/utils/motion-engine.utils';
	import { FLAME_STAGE_LABEL_KEYS } from '$lib/utils/streak.utils';

	interface Props {
		beat: MotionBeatPayload;
		bonusXp?: number;
		onDone: () => void;
	}

	const { beat, bonusXp = 0, onDone }: Props = $props();

	const copy = $derived.by(() => {
		if (beat.copyKey === null) {
			return null;
		}

		// `motion.streak_tier_up` interpolates `{stage}` from the localized
		// flame label, so resolve it here using the beat's `flameStage`.
		const params: Record<string, string | number> = { ...(beat.copyParams ?? {}) };

		if (beat.copyKey === 'motion.streak_tier_up' && beat.flameStage !== undefined) {
			params.stage = t({
				locale: $localeStore,
				key: FLAME_STAGE_LABEL_KEYS[beat.flameStage]
			});
		}

		return t({ locale: $localeStore, key: beat.copyKey, params });
	});

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
			{#if beat.badgeKey}
				<span class="motion-beat-badge allcaps">
					{t({ locale: $localeStore, key: beat.badgeKey })}
				</span>
			{/if}
			{#if copy !== null}
				<p class="motion-beat-line serif-italic">{copy}</p>
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
		background: color-mix(in srgb, var(--bg-base) 42%, transparent);
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
		/* Entrance envelope — drops in from below with a slight
		   overshoot, anchored to the bottom of the deck. */
		animation: motion-beat-rise var(--d-enter) cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes motion-beat-rise {
		0% {
			opacity: 0;
			transform: translateY(22px) scale(0.86);
		}
		60% {
			opacity: 1;
			transform: translateY(-2px) scale(1.04);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.motion-beat-inner {
			animation: none;
		}
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
		color: var(--text-base);
	}

	.motion-beat-xp {
		margin: 0;
		font-size: var(--t-13);
		color: var(--laurel);
		font-weight: 600;
	}
</style>
