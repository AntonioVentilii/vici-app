<script lang="ts">
	import OracleChar from '$lib/components/characters/OracleChar.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';

	// Cold-load Oracle moment shown while the first Flow card is still
	// fetching. An in-slot card skeleton holds the exact deck position and
	// size the real card will land in (shimmer sweep), the Oracle does a
	// subtle 3D wobble above it, and a short set of oracular lines cycles.
	// All motion is gated on `prefers-reduced-motion` — under reduce we show
	// a single static line, a still Oracle, and no shimmer. See
	// `docs/ai/frontend/design.md` §7 (Flow Mode).

	const ROTATION_INTERVAL_MS = 750;

	const LINE_KEYS = [
		'flow.loading.line_1',
		'flow.loading.line_2',
		'flow.loading.line_3',
		'flow.loading.line_4'
	] as const;

	const reduced = $derived(prefersReducedMotion());

	let lineIndex = $state(0);

	// Cycle the oracle copy only when motion is allowed. Under reduced motion
	// the index stays at 0, so a single static line is shown.
	$effect(() => {
		if (reduced) {
			lineIndex = 0;

			return;
		}

		const rotation = setInterval(() => {
			lineIndex = (lineIndex + 1) % LINE_KEYS.length;
		}, ROTATION_INTERVAL_MS);

		return () => clearInterval(rotation);
	});

	const currentLineKey = $derived(LINE_KEYS[lineIndex]);
</script>

<div
	class="flow-skeleton"
	aria-label={t({ locale: $localeStore, key: 'flow.loading.aria' })}
	aria-live="polite"
	role="status"
>
	<main class="flow-stage" aria-hidden="true">
		<div class="flow-card-wrap">
			<div class="flow-skeleton-card" class:is-static={reduced}>
				<span class="flow-skeleton-shimmer"></span>
				<span class="flow-skeleton-line flow-skeleton-line--art"></span>
				<span class="flow-skeleton-line flow-skeleton-line--title"></span>
				<span class="flow-skeleton-line flow-skeleton-line--sub"></span>
			</div>
		</div>
	</main>

	<div class="flow-skeleton-oracle" aria-hidden="true">
		<span class="flow-skeleton-oracle-float" class:is-static={reduced}>
			<span class="flow-skeleton-oracle-wobble" class:is-static={reduced}>
				<OracleChar animate={!reduced} size={76} />
			</span>
		</span>
		<p class="flow-skeleton-copy serif-italic" class:is-static={reduced}>
			{t({ locale: $localeStore, key: currentLineKey })}
		</p>
	</div>
</div>

<style lang="postcss">
	/* Cover the stage so the cold-load moment sits exactly where the deck
	   will render. The inner `.flow-stage` / `.flow-card-wrap` mirror the
	   deck geometry from FlowMode so the skeleton card box matches the real
	   card's position and size. */
	.flow-skeleton {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
	}

	.flow-stage {
		position: relative;
		flex: 1 1 auto;
		padding: 0.5rem 1rem 0.75rem;
		min-height: 0;
	}

	.flow-card-wrap {
		position: absolute;
		inset: 0.5rem 0.5rem var(--bn-clear) 0.5rem;
		max-width: min(25.5rem, calc(100vw - 2rem));
		margin-inline: auto;
	}

	@media (min-width: 56rem) {
		.flow-card-wrap {
			inset: 0.5rem 0.5rem 0.75rem 0.5rem;
		}
	}

	/* Card-shaped placeholder — rounded face and surface treatment that
	   mirror the real Flow card so the skeleton reads as its silhouette. */
	.flow-skeleton-card {
		position: absolute;
		inset: 0;
		overflow: hidden;
		border-radius: 20px;
		border: 1px solid var(--border-base);
		background: var(--bg-surface);
		box-shadow: 0 12px 40px -16px rgba(0, 0, 0, 0.5);
	}

	/* Shimmer sweep across the placeholder. Hidden when the card is static. */
	.flow-skeleton-shimmer {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			110deg,
			transparent 30%,
			color-mix(in srgb, var(--text-base) 12%, transparent) 50%,
			transparent 70%
		);
		animation: flow-skeleton-shimmer 1.4s ease-in-out infinite;
	}
	.flow-skeleton-card.is-static .flow-skeleton-shimmer {
		display: none;
	}

	/* Block placeholders roughly tracing the card's artwork + title rows. */
	.flow-skeleton-line {
		position: absolute;
		left: 14px;
		right: 14px;
		background: color-mix(in srgb, var(--text-base) 6%, transparent);
		border-radius: 12px;
	}
	.flow-skeleton-line--art {
		top: 16px;
		height: 44%;
	}
	.flow-skeleton-line--title {
		top: calc(16px + 44% + 18px);
		height: 18px;
		right: 32%;
	}
	.flow-skeleton-line--sub {
		top: calc(16px + 44% + 48px);
		height: 12px;
		right: 48%;
		border-radius: 8px;
	}

	/* Oracle + rotating copy, floated over the skeleton card. */
	.flow-skeleton-oracle {
		position: absolute;
		inset: 0;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 18px;
		pointer-events: none;
	}

	/* Gentle vertical float carries the whole Oracle cluster. */
	.flow-skeleton-oracle-float {
		display: flex;
		flex-direction: column;
		align-items: center;
		animation: flow-skeleton-float 3s ease-in-out infinite;
	}
	.flow-skeleton-oracle-float.is-static {
		animation: none;
	}

	/* 3D wobble — a slow yaw/pitch oscillation. No springy overshoot:
	   confidence doesn't bounce. */
	.flow-skeleton-oracle-wobble {
		display: block;
		transform-style: preserve-3d;
		filter: drop-shadow(0 10px 26px color-mix(in srgb, var(--laurel) 50%, transparent));
		animation: flow-skeleton-wobble 3s ease-in-out infinite;
	}
	.flow-skeleton-oracle-wobble.is-static {
		animation: none;
	}

	.flow-skeleton-copy {
		font-size: var(--text-h4);
		color: var(--text-base);
		text-align: center;
		animation: flow-skeleton-line-fade 1.5s ease-in-out infinite;
	}
	.flow-skeleton-copy.is-static {
		animation: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.flow-skeleton-shimmer,
		.flow-skeleton-oracle-float,
		.flow-skeleton-oracle-wobble,
		.flow-skeleton-copy {
			animation: none;
		}
		.flow-skeleton-shimmer {
			display: none;
		}
	}

	@keyframes flow-skeleton-shimmer {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(100%);
		}
	}

	@keyframes flow-skeleton-float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-12px);
		}
	}

	@keyframes flow-skeleton-wobble {
		0% {
			transform: perspective(600px) rotateY(-30deg) rotateX(7deg);
		}
		50% {
			transform: perspective(600px) rotateY(30deg) rotateX(-7deg);
		}
		100% {
			transform: perspective(600px) rotateY(-30deg) rotateX(7deg);
		}
	}

	@keyframes flow-skeleton-line-fade {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
	}
</style>
