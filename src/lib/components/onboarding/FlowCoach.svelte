<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Coach-marks overlay shown above the first-call prediction card in
	 * Beat 1.b. Three directional cues fan out from the centre — NO
	 * (left arrow), TAP (centre pulse), YES (right arrow) — with a
	 * one-line "swipe or tap" instruction underneath. Each arrow pulses
	 * on its own axis via the prototype `flow-coach-pulse-x-left`,
	 * `flow-coach-pulse-x-right`, and `flow-coach-pulse-y` keyframes;
	 * the centre tap glyph rides `flow-coach-tap-pulse`. The overlay
	 * envelope fades in with `flow-coach-fade-in`.
	 *
	 * Self-contained: owns its own visible state, opt-out via local
	 * dismiss. The parent only needs to mount it once inside the card
	 * stage.
	 */
	let visible = $state(true);

	const dismiss = () => {
		visible = false;
	};
</script>

{#if visible}
	<button
		class="flow-coach"
		aria-label={t({ locale: $localeStore, key: 'onboarding.beat1b.coach.dismiss' })}
		onclick={dismiss}
		type="button"
	>
		<span class="flow-coach-row" aria-hidden="true">
			<span class="flow-coach-side no">
				<span class="flow-coach-arrow left">←</span>
				<span class="flow-coach-label">
					{t({ locale: $localeStore, key: 'outcome.no' })}
				</span>
			</span>
			<span class="flow-coach-center">
				<span class="flow-coach-tap">
					<svg
						aria-hidden="true"
						fill="none"
						height="28"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.8"
						viewBox="0 0 24 24"
						width="28"
					>
						<path d="M9 11V6.5a2.5 2.5 0 0 1 5 0V12" />
						<path
							d="M9 11V8.5a2.5 2.5 0 0 0-5 0v6a7 7 0 0 0 7 7h2a7 7 0 0 0 7-7v-2a2.5 2.5 0 0 0-5 0v-1a2.5 2.5 0 0 0-5 0"
						/>
					</svg>
				</span>
				<span class="flow-coach-label center">
					{t({ locale: $localeStore, key: 'card.tap_depth' })}
				</span>
			</span>
			<span class="flow-coach-side yes">
				<span class="flow-coach-arrow right">→</span>
				<span class="flow-coach-label">
					{t({ locale: $localeStore, key: 'outcome.yes' })}
				</span>
			</span>
		</span>
		<span class="flow-coach-hint serif-italic">
			{t({ locale: $localeStore, key: 'onboarding.beat1b.coach.hint' })}
		</span>
	</button>
{/if}

<style lang="postcss">
	.flow-coach {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.85rem;
		padding: 1rem;
		appearance: none;
		font: inherit;
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-base) 62%, transparent);
		backdrop-filter: blur(2px);
		border: none;
		border-radius: var(--r-12);
		cursor: pointer;
		z-index: 5;
		animation: flow-coach-fade-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.flow-coach-row {
		display: grid;
		grid-template-columns: 1fr 1.2fr 1fr;
		align-items: center;
		gap: 0.65rem;
		width: 100%;
		max-width: 18rem;
	}

	.flow-coach-side {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.flow-coach-center {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
	}

	.flow-coach-tap {
		color: var(--color-accent);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.flow-coach-tap :global(svg) {
		animation: flow-coach-tap-pulse 1.8s ease-in-out infinite;
	}

	.flow-coach-arrow {
		font-family: var(--font-mono);
		font-size: 1.65rem;
		font-weight: 700;
		line-height: 1;
		display: inline-block;
	}

	.flow-coach-arrow.left {
		color: var(--no);
		animation: flow-coach-pulse-x-left 1.6s ease-in-out infinite;
	}

	.flow-coach-arrow.right {
		color: var(--yes);
		animation: flow-coach-pulse-x-right 1.6s ease-in-out infinite;
	}

	.flow-coach-label {
		font-family: var(--font-mono);
		font-size: var(--t-12);
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		font-weight: 700;
		color: var(--text-base);
	}

	.flow-coach-side.no .flow-coach-label {
		color: var(--no);
	}

	.flow-coach-side.yes .flow-coach-label {
		color: var(--yes);
	}

	.flow-coach-label.center {
		color: var(--color-accent);
	}

	.flow-coach-hint {
		font-size: var(--t-14);
		color: var(--text-base);
		text-align: center;
		max-width: 16rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.flow-coach,
		.flow-coach-arrow.left,
		.flow-coach-arrow.right,
		.flow-coach-tap :global(svg) {
			animation: none;
		}
	}
</style>
