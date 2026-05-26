<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Coach-marks overlay shown above the first-call prediction card in
	 * Beat 1.b. Two arrows fan out from the card centre toward YES (right)
	 * and NO (left) with a one-line "swipe or tap" instruction. The overlay
	 * dismisses on first tap anywhere — by then the user has either swiped
	 * or read the hint, and the card itself is what they should be
	 * interacting with.
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
		<span class="flow-coach-mark flow-coach-mark-no" aria-hidden="true">
			<span class="flow-coach-arrow">←</span>
			<span class="flow-coach-label">
				{t({ locale: $localeStore, key: 'outcome.no' })}
			</span>
		</span>
		<span class="flow-coach-mark flow-coach-mark-yes" aria-hidden="true">
			<span class="flow-coach-label">
				{t({ locale: $localeStore, key: 'outcome.yes' })}
			</span>
			<span class="flow-coach-arrow">→</span>
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
		gap: 0.75rem;
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
		animation: flow-coach-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}

	.flow-coach-mark {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.4rem 0.85rem;
		font-family: var(--font-display);
		font-size: var(--t-13);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		border-radius: var(--r-pill);
	}

	.flow-coach-mark-no {
		color: var(--no);
		background: color-mix(in srgb, var(--no) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 28%, transparent);
		align-self: flex-start;
		animation: flow-coach-nudge-left 1.6s ease-in-out infinite;
	}

	.flow-coach-mark-yes {
		color: var(--yes);
		background: color-mix(in srgb, var(--yes) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--yes) 28%, transparent);
		align-self: flex-end;
		animation: flow-coach-nudge-right 1.6s ease-in-out infinite;
	}

	.flow-coach-arrow {
		font-size: 1.2rem;
		line-height: 1;
	}

	.flow-coach-label {
		letter-spacing: var(--tracking-allcaps);
	}

	.flow-coach-hint {
		font-size: var(--t-14);
		color: var(--text-base);
		text-align: center;
		max-width: 16rem;
	}

	@keyframes flow-coach-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes flow-coach-nudge-left {
		0%,
		100% {
			transform: translateX(0);
		}
		50% {
			transform: translateX(-6px);
		}
	}

	@keyframes flow-coach-nudge-right {
		0%,
		100% {
			transform: translateX(0);
		}
		50% {
			transform: translateX(6px);
		}
	}
</style>
