<script lang="ts">
	import { fade } from 'svelte/transition';
	import FlameChar from '$lib/components/characters/FlameChar.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';
	import type { FlameStage } from '$lib/utils/streak.utils';

	interface Props {
		maxBets: number;
		betsCount: number;
		dailyStreak: number;
		flameStage: FlameStage;
		flameLabel: string;
		xp: number;
		onExit: () => void;
	}

	const { maxBets, betsCount, dailyStreak, flameStage, flameLabel, xp, onExit }: Props = $props();
</script>

<header class="flow-topbar" in:fade>
	<button
		class="flow-icon-btn"
		aria-label={t({ locale: $localeStore, key: 'flow.exit_aria' })}
		onclick={onExit}
	>
		<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				d="M6 18L18 6M6 6l12 12"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2.5"
			/>
		</svg>
	</button>

	<div class="flow-progress" aria-label={t({ locale: $localeStore, key: 'flow.progress_aria' })}>
		{#each Array(maxBets) as _, i (i)}
			<div class="flow-progress-seg">
				<div
					style:--p={i < betsCount ? '100%' : i === betsCount ? '30%' : '0%'}
					class="flow-progress-fill"
					class:is-current={i === betsCount}
					class:is-full={i < betsCount}
				></div>
			</div>
		{/each}
	</div>

	<div class="flow-stats">
		<div
			class="flow-stat flow-stat-flame"
			class:is-hot={dailyStreak >= 7}
			aria-label={t({ locale: $localeStore, key: 'flow.daily_streak_aria' })}
		>
			<FlameChar animate={dailyStreak >= 1} size={20} stage={flameStage} />
			<span class="flow-flame-meta">
				<span class="flow-flame-label">{flameLabel}</span>
				<span class="num flow-flame-count">
					{t({ locale: $localeStore, key: 'flow.streak_days', params: { count: dailyStreak } })}
				</span>
			</span>
		</div>
		<div
			class="flow-stat flow-stat-xp"
			aria-label={t({ locale: $localeStore, key: 'flow.xp_aria' })}
		>
			<span class="text-laurel text-[10px] font-black tracking-widest">
				{t({ locale: $localeStore, key: 'flow.xp_label' })}
			</span>
			<span class="text-foreground font-mono tabular-nums">{xp}</span>
		</div>
	</div>
</header>

<style lang="postcss">
	.flow-topbar {
		position: sticky;
		top: 0;
		z-index: 60;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.65rem;
		padding: calc(env(safe-area-inset-top, 0px) + 0.45rem) 0.8rem 0.45rem
			calc(env(safe-area-inset-left, 0px) + 0.8rem);
		padding-right: calc(env(safe-area-inset-right, 0px) + 0.8rem);
		background: linear-gradient(
			to bottom,
			color-mix(in srgb, var(--bg-base) 96%, transparent),
			color-mix(in srgb, var(--bg-base) 72%, transparent)
		);
		backdrop-filter: saturate(180%) blur(12px);
		-webkit-backdrop-filter: saturate(180%) blur(12px);
		border-bottom: 1px solid var(--border-base);
	}

	.flow-icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		background: var(--border-base);
		color: var(--text-base);
		transition:
			transform 0.15s ease,
			background-color 0.2s ease;
	}
	.flow-icon-btn:active {
		transform: scale(0.985);
		background: var(--border-strong);
	}

	.flow-progress {
		display: flex;
		align-items: center;
		gap: 3px;
		min-width: 0;
	}
	.flow-progress-seg {
		flex: 1;
		height: 3px;
		border-radius: 999px;
		background: var(--border-base);
		overflow: hidden;
	}
	.flow-progress-fill {
		height: 100%;
		width: var(--p);
		background: linear-gradient(90deg, var(--color-primary), var(--laurel));
		border-radius: inherit;
		transition: width 450ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.flow-progress-fill.is-current {
		animation: progressPulse 1.6s ease-in-out infinite;
	}
	@keyframes progressPulse {
		0%,
		100% {
			opacity: 0.6;
		}
		50% {
			opacity: 1;
		}
	}

	.flow-stats {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.flow-stat {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		border-radius: 999px;
		font-weight: 900;
		font-size: 12px;
		line-height: 1;
	}
	/* Daily-streak Flame chip: shows the current stage + day count.
	   Flame appears in the Flow header + home screen only (never on
	   every screen); always-visible here, never dominant. Activates
	   `is-hot` from FLAME stage upward. */
	.flow-stat-flame {
		gap: 6px;
		padding: 4px 9px 4px 6px;
		background: var(--bg-surface);
		color: var(--text-muted);
		transition:
			transform var(--d-state) var(--ease-vici),
			background-color var(--d-state) var(--ease-vici);
	}
	.flow-stat-flame.is-hot {
		background: linear-gradient(135deg, var(--color-primary), var(--laurel));
		color: var(--color-primary-foreground);
		box-shadow: 0 4px 12px var(--laurel-glow);
	}
	.flow-flame-meta {
		display: inline-flex;
		flex-direction: column;
		align-items: flex-start;
		line-height: 1;
	}
	.flow-flame-label {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		opacity: 0.85;
	}
	.flow-flame-count {
		font-size: 11px;
		font-weight: 600;
	}
	@keyframes hotPulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.06);
		}
	}
	.flow-stat-xp {
		background: var(--bg-surface);
		display: inline-flex;
		gap: 5px;
		align-items: baseline;
		font-variant-numeric: tabular-nums;
	}
</style>
