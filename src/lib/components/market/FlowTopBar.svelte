<script lang="ts">
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import StreakFlame from '$lib/components/characters/StreakFlame.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { combinedInboxUnreadCount } from '$lib/stores/inbox.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';
	import type { FlameStage } from '$lib/utils/streak.utils';

	/**
	 * FlowTopBar — sticky header for Flow Mode.
	 *
	 * Layout: VICI wordmark + category deck badge ("WORLD CUP" /
	 * "N CATS") + bolt streak chip on the left, bell on the right. A
	 * secondary row carries `idx / total` + `+xp VXP this session`
	 * and a thin progress bar. Tapping the wordmark exits Flow.
	 */
	interface Props {
		maxBets: number;
		betsCount: number;
		dailyStreak: number;
		flameStage: FlameStage;
		xp: number;
		categoryLabel: string;
		onExit: () => void;
	}

	const { maxBets, betsCount, dailyStreak, flameStage, xp, categoryLabel, onExit }: Props =
		$props();

	const progressPct = $derived(maxBets > 0 ? Math.min(100, (betsCount / maxBets) * 100) : 0);

	const openSettings = () => {
		goto(resolve(AppPath.Settings));
	};

	const openNotifications = () => {
		goto(resolve(AppPath.Notifications));
	};
</script>

<header class="flow-topbar" in:fade>
	<div class="flow-topbar-row">
		<div class="flow-topbar-left">
			<button
				class="flow-wordmark"
				aria-label={t({ locale: $localeStore, key: 'flow.exit_aria' })}
				onclick={onExit}
				type="button"
			>
				VICI
			</button>
			<button class="flow-deck-badge" onclick={openSettings} title={categoryLabel} type="button">
				<span class="flow-deck-dot" aria-hidden="true"></span>
				<span class="flow-deck-label allcaps">{categoryLabel}</span>
			</button>
			<span
				class="flow-streak-chip"
				aria-label={t({ locale: $localeStore, key: 'flow.daily_streak_aria' })}
			>
				<svg
					class="flow-streak-bolt"
					aria-hidden="true"
					fill="currentColor"
					height="11"
					viewBox="0 0 24 24"
					width="11"
				>
					<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
				</svg>
				<span class="num">{betsCount}/{maxBets}</span>
			</span>
		</div>

		<div class="flow-topbar-right">
			<!-- Streak chip: just the flame icon + the day count. We
			     intentionally drop the `flameStage` label (SPARK / EMBER /
			     etc.) and the `d` suffix — the stage colour is already
			     encoded in the flame gradient and the number reads as
			     "days" in context. Chip stays mounted at streak 0 so the
			     top-bar row geometry never reflows. -->
			<span
				class="flow-flame-chip"
				aria-label={t({ locale: $localeStore, key: 'flow.daily_streak_aria' })}
			>
				<StreakFlame count={dailyStreak} size={14} stage={flameStage} />
				<span class="num flow-flame-count">{dailyStreak}</span>
			</span>
			<button
				class="flow-bell-btn"
				aria-label={t({ locale: $localeStore, key: 'a11y.notifications' })}
				onclick={openNotifications}
				type="button"
			>
				<svg
					aria-hidden="true"
					fill="none"
					height="18"
					stroke="currentColor"
					stroke-width="1.8"
					viewBox="0 0 24 24"
					width="18"
				>
					<path
						d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path d="M13.73 21a2 2 0 0 1-3.46 0" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				{#if $combinedInboxUnreadCount > 0}
					<span class="flow-bell-badge num" aria-hidden="true">
						{$combinedInboxUnreadCount > 9 ? '9+' : $combinedInboxUnreadCount}
					</span>
				{/if}
			</button>
		</div>
	</div>

	<div class="flow-progress-row">
		<div class="flow-progress-meta">
			<span class="num flow-progress-count">
				{t({
					locale: $localeStore,
					key: 'flow.progress_count',
					params: { done: betsCount, total: maxBets }
				})}
			</span>
			<span class="num flow-progress-xp">
				{t({
					locale: $localeStore,
					key: 'flow.session_xp_subtitle',
					params: { xp }
				})}
			</span>
		</div>
		<div
			class="flow-progress-track"
			aria-label={t({ locale: $localeStore, key: 'flow.progress_aria' })}
		>
			<div style:width="{progressPct}%" class="flow-progress-fill"></div>
		</div>
	</div>
</header>

<style lang="postcss">
	.flow-topbar {
		position: sticky;
		top: 0;
		z-index: 60;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding: calc(env(safe-area-inset-top, 0px) + 0.45rem)
			calc(env(safe-area-inset-right, 0px) + 0.85rem) 0.55rem
			calc(env(safe-area-inset-left, 0px) + 0.85rem);
		background: linear-gradient(
			to bottom,
			color-mix(in srgb, var(--bg-base) 96%, transparent),
			color-mix(in srgb, var(--bg-base) 72%, transparent)
		);
		backdrop-filter: saturate(180%) blur(12px);
		-webkit-backdrop-filter: saturate(180%) blur(12px);
		border-bottom: 1px solid var(--border-base);
	}

	.flow-topbar-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
	}

	.flow-topbar-left {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
	}

	.flow-topbar-right {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.flow-wordmark {
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 700;
		letter-spacing: 0.18em;
		color: var(--color-primary);
		line-height: 1;
		padding: 2px 4px;
		background: transparent;
	}

	.flow-deck-badge {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 8px;
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		color: var(--text-muted);
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		border: 1px solid var(--border-base);
		transition:
			color 160ms ease,
			background-color 160ms ease;
	}
	.flow-deck-badge:hover {
		color: var(--text-base);
		background: var(--bg-popover);
	}

	.flow-deck-dot {
		width: 6px;
		height: 6px;
		border-radius: var(--r-pill);
		background: var(--yes);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--yes) 22%, transparent);
		animation: flow-topbar-pulse 1.8s ease-in-out infinite;
	}

	.flow-streak-chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 3px 8px;
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		color: var(--color-primary);
		font-size: var(--t-11);
		font-weight: 700;
		border: 1px solid var(--border-base);
	}

	.flow-streak-bolt {
		color: var(--color-primary);
	}

	.flow-flame-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 3px 9px 3px 5px;
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		color: var(--text-muted);
		border: 1px solid var(--border-base);
	}

	.flow-flame-count {
		font-size: var(--t-10);
		font-weight: 700;
		color: var(--color-primary);
	}

	.flow-bell-btn {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: var(--r-pill);
		color: var(--text-muted);
		background: transparent;
		transition:
			color 160ms ease,
			background-color 160ms ease,
			transform 160ms ease;
	}
	.flow-bell-btn:hover {
		color: var(--text-base);
		background: var(--bg-surface);
	}
	.flow-bell-btn:active {
		transform: scale(0.94);
	}

	/* Unread-count badge — top-right corner pip on the bell. Tracks
	   `combinedInboxUnreadCount`; collapses to `9+` past nine to keep
	   the bubble from stretching the bar. */
	.flow-bell-badge {
		position: absolute;
		top: 2px;
		right: 2px;
		min-width: 14px;
		height: 14px;
		padding: 0 4px;
		border-radius: var(--r-pill);
		background: var(--no);
		color: var(--background, #fff);
		font-size: 9px;
		font-weight: 700;
		line-height: 14px;
		text-align: center;
		letter-spacing: 0;
		box-shadow: 0 0 0 2px var(--bg-base);
	}

	.flow-progress-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.flow-progress-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: var(--t-11);
		font-weight: 600;
		letter-spacing: var(--tracking-wide);
	}

	.flow-progress-count {
		color: var(--text-muted);
	}

	.flow-progress-xp {
		color: var(--color-primary);
		font-weight: 700;
	}

	.flow-progress-track {
		height: 3px;
		width: 100%;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-base) 8%, transparent);
		overflow: hidden;
	}

	.flow-progress-fill {
		height: 100%;
		background: var(--color-primary);
		border-radius: inherit;
		transition: width var(--d-enter) cubic-bezier(0.22, 1, 0.36, 1);
	}

	@keyframes flow-topbar-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.flow-deck-dot,
		.flow-progress-fill {
			animation: none;
			transition: none;
		}
	}
</style>
