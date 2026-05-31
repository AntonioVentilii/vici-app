<script lang="ts">
	import { onMount } from 'svelte';
	import FlameChar from '$lib/components/characters/FlameChar.svelte';
	import OracleChar from '$lib/components/characters/OracleChar.svelte';
	import TricksterChar from '$lib/components/characters/TricksterChar.svelte';
	import ViciChar from '$lib/components/characters/ViciChar.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';
	import type { MotionBeatPayload } from '$lib/utils/motion-engine.utils';
	import type { FlameStage } from '$lib/utils/streak.utils';

	interface Props {
		beat: MotionBeatPayload;
		onDone: () => void;
	}

	const { beat, onDone }: Props = $props();

	// The engine's NONE/SPARK/… tier maps onto the Flame renderer's
	// lower-case stage names; the resolver never emits NONE for a beat
	// (it floors to SPARK), so `flame` is a safe fallback.
	const flameStage = $derived.by((): FlameStage => {
		switch (beat.tier) {
			case 'SPARK':
				return 'spark';
			case 'EMBER':
				return 'ember';
			case 'BLAZE':
				return 'blaze';
			case 'INFERNO':
				return 'inferno';
			default:
				return 'flame';
		}
	});

	const copy = $derived(
		beat.copyKey === null ? null : t({ locale: $localeStore, key: beat.copyKey })
	);
	const sub = $derived(
		beat.subKey === undefined ? null : t({ locale: $localeStore, key: beat.subKey })
	);
	const treat = $derived(
		beat.treatKey === undefined ? null : t({ locale: $localeStore, key: beat.treatKey })
	);
	const badge = $derived(
		beat.badgeKey === undefined ? null : t({ locale: $localeStore, key: beat.badgeKey })
	);
	const titleUnlocked = $derived(
		beat.titleCharacter === undefined
			? null
			: t({ locale: $localeStore, key: 'motion.title_unlocked' })
	);

	onMount(() => {
		const total = beat.duration_ms + 500;
		const id = setTimeout(onDone, total);

		return () => clearTimeout(id);
	});
</script>

<div class="motion-beat" aria-live="polite" role="status">
	<div class="motion-beat-inner">
		{#if beat.character === 'oracle'}
			<OracleChar animate size={48} />
		{:else if beat.character === 'trickster'}
			<TricksterChar animate lightning size={48} />
		{:else if beat.character === 'flame'}
			<FlameChar animate size={48} stage={flameStage} />
		{:else}
			<ViciChar mood="happy" size={48} />
		{/if}

		<div class="motion-beat-copy">
			{#if badge !== null}
				<span class="motion-beat-badge allcaps">{badge}</span>
			{/if}
			{#if copy !== null}
				<p class="motion-beat-line serif-italic">{copy}</p>
			{/if}
			{#if beat.bonusXp > 0 || treat !== null}
				<p class="motion-beat-meta">
					{#if beat.bonusXp > 0}
						<span class="motion-beat-coin num">+{beat.bonusXp} VXP</span>
					{/if}
					{#if treat !== null}
						<span class="motion-beat-treat">{treat}</span>
					{/if}
				</p>
			{/if}
			{#if titleUnlocked !== null}
				<span class="motion-beat-badge allcaps">{titleUnlocked}</span>
			{:else if badge === null && sub !== null}
				<span class="motion-beat-sub allcaps">{sub}</span>
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
		font-size: var(--t-10);
		color: var(--laurel);
		letter-spacing: var(--tracking-allcaps);
	}

	.motion-beat-line {
		margin: 0;
		font-size: var(--t-16);
		line-height: var(--leading-snug);
		color: var(--text-base);
	}

	.motion-beat-meta {
		margin: 0;
		display: flex;
		gap: 0.5rem;
		align-items: center;
		font-size: var(--t-13);
	}

	.motion-beat-coin {
		color: var(--laurel);
		font-weight: 600;
	}

	.motion-beat-treat {
		color: var(--text-muted);
	}

	.motion-beat-sub {
		font-size: var(--t-10);
		color: var(--text-muted);
		letter-spacing: var(--tracking-allcaps);
	}
</style>
