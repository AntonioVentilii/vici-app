<script lang="ts">
	import { onMount } from 'svelte';
	import FlameChar from '$lib/components/characters/FlameChar.svelte';
	import OracleChar from '$lib/components/characters/OracleChar.svelte';
	import TricksterChar from '$lib/components/characters/TricksterChar.svelte';
	import ViciChar from '$lib/components/characters/ViciChar.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import type { MotionBeatPayload } from '$lib/utils/motion-engine.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';
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

	// Hard beats stand BIGGEST in the empty slot: the Flame milestone, the
	// comeback opener, the first-contrarian moment, and every lifetime
	// volume milestone (`volume-*`). Everything else gets the soft size.
	const isHardBeat = $derived(
		beat.character === 'flame' ||
			beat.kind === 'comeback' ||
			beat.kind === 'first-contrarian' ||
			beat.kind.startsWith('volume-')
	);

	// Ambient (`ambient-10`) is intentionally minimal — a small character
	// pop with no copy / chips. Everything else carries the full stack.
	const isAmbient = $derived(beat.kind === 'ambient-10');

	// Large character in the gap: hard beats 132 px, soft beats 96 px,
	// ambient pops 44 px.
	const charSize = $derived(isAmbient ? 44 : isHardBeat ? 132 : 96);

	const nameKey = $derived.by((): MessageKey => {
		switch (beat.character) {
			case 'oracle':
				return 'motion.name.oracle';
			case 'trickster':
				return 'motion.name.trickster';
			case 'flame':
				return 'motion.name.flame';
			default:
				return 'motion.name.vici';
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
		beat.badgeKey === undefined
			? null
			: t({
					locale: $localeStore,
					key: 'motion.badge_label',
					params: { badge: t({ locale: $localeStore, key: beat.badgeKey }) }
				})
	);
	const titleUnlocked = $derived(
		beat.titleCharacter === undefined
			? null
			: t({ locale: $localeStore, key: 'motion.title_unlocked' })
	);

	// Eased count-up for the VXP coin chip (cubic ease-out). Reduced-motion
	// users jump straight to the final value — no rAF loop.
	let coinValue = $state(0);

	const cleanups: Array<() => void> = [];

	onMount(() => {
		const to = beat.bonusXp;

		if (to <= 0) {
			coinValue = to;
		} else if (prefersReducedMotion()) {
			coinValue = to;
		} else {
			let raf = 0;
			const dur = 520;
			const t0 = performance.now();

			const step = (now: number) => {
				const p = Math.min(1, (now - t0) / dur);
				coinValue = Math.round(to * (1 - Math.pow(1 - p, 3)));

				if (p < 1) {
					raf = requestAnimationFrame(step);
				}
			};

			raf = requestAnimationFrame(step);
			cleanups.push(() => cancelAnimationFrame(raf));
		}

		// Auto-dismiss after the beat's duration plus a short trail.
		const total = beat.duration_ms + 500;
		const id = setTimeout(onDone, total);

		cleanups.push(() => clearTimeout(id));

		return () => cleanups.forEach((fn) => fn());
	});
</script>

<div
	class="motion-beat is-center motion-beat-{beat.character}"
	class:is-ambient={isAmbient}
	aria-live="polite"
	role="status"
>
	<div class="motion-beat-inner">
		<div class="motion-beat-char">
			{#if beat.character === 'oracle'}
				<OracleChar animate size={charSize} />
			{:else if beat.character === 'trickster'}
				<TricksterChar animate lightning size={charSize} />
			{:else if beat.character === 'flame'}
				<FlameChar animate size={charSize} stage={flameStage} />
			{:else}
				<ViciChar mood="happy" size={charSize} />
			{/if}
		</div>

		{#if !isAmbient}
			<div class="motion-beat-text">
				<span class="motion-beat-name allcaps">{t({ locale: $localeStore, key: nameKey })}</span>
				{#if copy !== null}
					<p class="motion-beat-copy serif-italic">{copy}</p>
				{/if}
				{#if coinValue > 0 || treat !== null}
					<p class="motion-beat-meta">
						{#if coinValue > 0}
							<span class="motion-beat-coin num">
								<span class="coin" aria-hidden="true"></span>+{coinValue} VXP
							</span>
						{/if}
						{#if treat !== null}
							<span class="motion-beat-treat">{treat}</span>
						{/if}
					</p>
				{/if}
				{#if badge !== null}
					<span class="motion-beat-badge allcaps">{badge}</span>
				{:else if titleUnlocked !== null}
					<span class="motion-beat-badge allcaps">{titleUnlocked}</span>
				{:else if sub !== null}
					<span class="motion-beat-sub allcaps">{sub}</span>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style lang="postcss">
	/* Centered-in-the-gap staging: the REAL character stands LARGE in the
	   empty slot — no pill chrome — with name / copy / chips / sub-label
	   stacked below and a soft radial glow behind. The card-out → gap →
	   next-card-rise sequence is orchestrated by FlowMode; this overlay
	   owns only the in-gap character moment. Global enter/exit keyframes
	   (`motion-beat-in` / `motion-beat-out`) live in `app.css`. */
	.motion-beat {
		position: absolute;
		top: 36%;
		left: 50%;
		transform: translate(-50%, 0);
		z-index: 40;
		pointer-events: none;
		opacity: 0;
		max-width: calc(100% - 2rem);
		animation:
			motion-beat-in 360ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
			motion-beat-out 320ms ease-in forwards;
		animation-delay: 0s, 1100ms;
	}

	.motion-beat.is-ambient {
		animation:
			motion-beat-in 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
			motion-beat-out 240ms ease-in forwards;
		animation-delay: 0s, 380ms;
	}

	@media (prefers-reduced-motion: reduce) {
		.motion-beat {
			/* Springs collapse to a plain opacity fade — no overshoot, no
			   travel — keeping the centred transform fixed at (-50%, 0). */
			animation:
				motion-beat-rm-in 200ms ease forwards,
				motion-beat-rm-out 200ms ease forwards;
			animation-delay: 0s, 1100ms;
		}
		.motion-beat.is-ambient {
			animation-delay: 0s, 380ms;
		}
	}
	@keyframes motion-beat-rm-in {
		from {
			opacity: 0;
			transform: translate(-50%, 0);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}
	@keyframes motion-beat-rm-out {
		to {
			opacity: 0;
			transform: translate(-50%, 0);
		}
	}

	.motion-beat-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5625rem;
	}

	.motion-beat-char {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.motion-beat-char::before {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: 300px;
		height: 300px;
		transform: translate(-50%, -50%);
		z-index: -1;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(226, 184, 66, 0.16), transparent 64%);
	}
	.motion-beat.motion-beat-flame .motion-beat-char::before {
		width: 360px;
		height: 360px;
		background: radial-gradient(circle, rgba(240, 138, 60, 0.22), transparent 64%);
	}
	.motion-beat.motion-beat-trickster .motion-beat-char::before {
		background: radial-gradient(circle, rgba(255, 138, 122, 0.18), transparent 64%);
	}

	.motion-beat-text {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 5px;
		min-width: 0;
	}

	.motion-beat-name {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.24em;
		color: var(--text-muted);
	}

	.motion-beat-copy {
		margin: 0;
		font-size: 30px;
		line-height: 1.08;
		max-width: 13ch;
		color: var(--color-accent);
	}
	.motion-beat.motion-beat-flame .motion-beat-copy {
		font-size: 34px;
		color: var(--char-flame, #f08a3c);
	}
	.motion-beat.motion-beat-trickster .motion-beat-copy {
		color: var(--char-trickster, #ff8a7a);
	}

	.motion-beat-meta {
		margin: 6px 0 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	/* Gold coin chip — the VXP grant riding along with the beat. */
	.motion-beat-coin {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-mono);
		font-weight: 800;
		font-size: var(--text-eyebrow);
		color: #241c08;
		background: #e9c254;
		padding: 3px 9px 3px 6px;
		border-radius: 999px;
		box-shadow: 0 0 0 3px rgba(226, 184, 66, 0.16);
	}
	.motion-beat-coin .coin {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 30%, #fff5cf, #e2b842 60%, #b8901f);
		box-shadow: inset 0 0 0 1px rgba(120, 90, 15, 0.4);
	}

	/* Coral treat chip — the non-currency wildcard reward. */
	.motion-beat-treat {
		display: inline-flex;
		font-family: var(--font-mono);
		font-weight: 800;
		font-size: var(--text-eyebrow);
		color: #2a1208;
		background: #ff9a8b;
		padding: 3px 10px;
		border-radius: 999px;
	}

	.motion-beat-badge {
		font-family: var(--font-mono);
		font-size: var(--text-micro);
		font-weight: 700;
		letter-spacing: 0.14em;
		color: var(--color-accent);
		margin-top: 2px;
	}

	.motion-beat-sub {
		font-family: var(--font-mono);
		font-size: var(--text-micro);
		font-weight: 600;
		letter-spacing: 0.14em;
		color: var(--text-muted);
		margin-top: 3px;
	}
</style>
