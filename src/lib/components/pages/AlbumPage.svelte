<script lang="ts">
	import type { Icon as LucideIcon } from 'lucide-svelte';
	import { Eye, Flame, Star, Target, Timer, X, Zap } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import { evaluateAchievements, type AchievementEvaluation } from '$lib/utils/achievements.utils';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Album — milestone awards / stickers gallery. Reached as a profile
	 * sub-route. Shows every achievement defined in `ACHIEVEMENTS`,
	 * each as a tile in a 3-column grid with its tier wash. Tapping a
	 * tile opens a bottom-sheet with the full description + the
	 * progress bar for the not-yet-earned ones.
	 *
	 * Sources its progress from the user's live profile via the
	 * `evaluateAchievements` helper — same engine that fires the
	 * one-shot unlocks during normal trading.
	 */

	const ICON_BY_NAME: Record<string, typeof LucideIcon> = {
		target: Target,
		flame: Flame,
		eye: Eye,
		zap: Zap,
		timer: Timer,
		star: Star
	};

	const evaluations = $derived.by((): AchievementEvaluation[] => {
		const { profile } = $userStore;

		if (!profile) {
			return [];
		}

		return evaluateAchievements({
			totalTrades: profile.totalTrades ?? 0,
			winStreak: profile.streak ?? 0,
			dailyStreak: profile.dailyStreak ?? 0,
			accuracy: profile.accuracy ?? 0,
			level: profile.level ?? 1,
			contrarianWins: profile.contrarianWins ?? 0
		});
	});

	const earned = $derived(evaluations.filter((e) => e.unlocked).length);
	const total = $derived(evaluations.length);

	let openTarget = $state<AchievementEvaluation | null>(null);
</script>

<div class="album-page">
	<MobileAppBar
		align="left"
		back={{
			label: t({ locale: $localeStore, key: 'album.back' }),
			onBack: () => void goto(resolve(AppPath.Profile))
		}}
		title={t({ locale: $localeStore, key: 'album.title' })}
	/>

	<section class="album-progress">
		<span class="eyebrow album-progress-label">
			{t({ locale: $localeStore, key: 'album.progress_eyebrow' })}
		</span>
		<div class="album-progress-counts">
			<span class="num album-progress-earned">{earned}</span>
			<span class="album-progress-of">
				{t({ locale: $localeStore, key: 'album.progress_of', params: { total } })}
			</span>
		</div>
		<div
			class="album-progress-bar"
			aria-valuemax={total}
			aria-valuemin="0"
			aria-valuenow={earned}
			role="progressbar"
		>
			<span style:width={`${total === 0 ? 0 : (earned / total) * 100}%`}></span>
		</div>
	</section>

	<div class="album-grid">
		{#each evaluations as evaluation (evaluation.id)}
			{@const Icon = ICON_BY_NAME[evaluation.def.icon]}
			<button
				class="album-award"
				class:is-locked={!evaluation.unlocked}
				onclick={() => (openTarget = evaluation)}
				type="button"
			>
				<span class="album-award-emblem" aria-hidden="true">
					<Icon size={28} strokeWidth={1.6} />
				</span>
				<span class="album-award-title">
					{t({ locale: $localeStore, key: evaluation.def.nameKey })}
				</span>
				<span class="album-award-sub allcaps">
					{t({ locale: $localeStore, key: evaluation.def.descriptionKey })}
				</span>
			</button>
		{/each}
	</div>
</div>

{#if openTarget}
	{@const Icon = ICON_BY_NAME[openTarget.def.icon]}
	<div
		class="album-sheet-backdrop"
		aria-label="Close"
		onclick={() => (openTarget = null)}
		onkeydown={(e) => {
			if (e.key === 'Escape' || e.key === 'Enter') {
				openTarget = null;
			}
		}}
		role="button"
		tabindex="0"
	>
		<div
			class="album-sheet"
			aria-modal="true"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
		>
			<div class="album-sheet-head">
				<span
					class="eyebrow"
					class:album-sheet-earned={openTarget.unlocked}
					class:album-sheet-locked={!openTarget.unlocked}
				>
					{t({
						locale: $localeStore,
						key: openTarget.unlocked ? 'album.awarded' : 'album.locked'
					})}
				</span>
				<button
					class="album-sheet-close"
					aria-label={t({ locale: $localeStore, key: 'album.close' })}
					onclick={() => (openTarget = null)}
					type="button"
				>
					<X size={16} strokeWidth={1.8} />
				</button>
			</div>

			<div class="album-sheet-body">
				<div class="album-sheet-emblem" class:is-locked={!openTarget.unlocked}>
					<Icon size={32} strokeWidth={1.6} />
				</div>
				<div>
					<div class="album-sheet-title">
						{t({ locale: $localeStore, key: openTarget.def.nameKey })}
					</div>
					<div class="album-sheet-sub allcaps">
						{t({ locale: $localeStore, key: openTarget.def.descriptionKey })}
					</div>
				</div>
			</div>

			<p class="album-sheet-detail">
				+{openTarget.def.xp} VXP · {t({
					locale: $localeStore,
					key: openTarget.def.descriptionKey
				})}
			</p>

			{#if !openTarget.unlocked}
				<div class="album-sheet-progress">
					<div class="album-sheet-progress-head">
						<span class="eyebrow">
							{t({ locale: $localeStore, key: 'album.progress_eyebrow' })}
						</span>
						<span class="num album-sheet-progress-value">
							{Math.round(openTarget.progress * 100)}%
						</span>
					</div>
					<div class="album-sheet-progress-bar">
						<span style:width={`${openTarget.progress * 100}%`}></span>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style lang="postcss">
	.album-page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0 1.25rem 6rem;
	}

	.album-progress {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.9rem 1rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.album-progress-label {
		color: var(--text-muted);
	}

	.album-progress-counts {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.album-progress-earned {
		font-size: var(--t-28, 1.75rem);
		font-weight: 700;
		color: var(--text-base);
	}

	.album-progress-of {
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.album-progress-bar {
		position: relative;
		height: 4px;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-base) 8%, transparent);
		overflow: hidden;
	}

	.album-progress-bar > span {
		display: block;
		height: 100%;
		background: var(--laurel);
		transition: width 360ms ease;
	}

	.album-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.65rem;
	}

	.album-award {
		appearance: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		padding: 0.85rem 0.5rem;
		font: inherit;
		text-align: center;
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		cursor: pointer;
		transition:
			transform 140ms ease,
			border-color 140ms ease;
	}

	.album-award:hover {
		transform: translateY(-1px);
		border-color: color-mix(in srgb, var(--laurel) 30%, var(--border-base));
	}

	.album-award.is-locked {
		opacity: 0.5;
	}

	.album-award-emblem {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		color: var(--laurel);
	}

	.album-award.is-locked .album-award-emblem {
		color: var(--text-muted);
	}

	.album-award-title {
		font-size: var(--t-12);
		font-weight: 700;
		color: var(--text-base);
	}

	.album-award-sub {
		font-size: var(--t-10, 0.65rem);
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
	}

	.album-sheet-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(14, 13, 11, 0.78);
		backdrop-filter: blur(10px);
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		z-index: 80;
	}

	.album-sheet {
		background: var(--bg-surface);
		border-top-left-radius: 22px;
		border-top-right-radius: 22px;
		border-top: 1px solid var(--border-base);
		padding: 1.4rem 1.4rem calc(1.4rem + env(safe-area-inset-bottom, 0px));
		max-height: 80vh;
		overflow-y: auto;
	}

	.album-sheet-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.85rem;
	}

	.album-sheet-earned {
		color: var(--laurel);
	}

	.album-sheet-locked {
		color: var(--text-muted);
	}

	.album-sheet-close {
		appearance: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: none;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		color: var(--text-muted);
		cursor: pointer;
	}

	.album-sheet-body {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		margin-bottom: 0.9rem;
	}

	.album-sheet-emblem {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		background: color-mix(in srgb, var(--laurel) 14%, transparent);
		border-radius: var(--r-12);
		color: var(--laurel);
	}

	.album-sheet-emblem.is-locked {
		background: color-mix(in srgb, var(--text-muted) 14%, transparent);
		color: var(--text-muted);
	}

	.album-sheet-title {
		font-size: var(--t-18, 1.2rem);
		font-weight: 600;
		color: var(--text-base);
	}

	.album-sheet-sub {
		font-size: var(--t-11, 0.7rem);
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
		margin-top: 0.15rem;
	}

	.album-sheet-detail {
		margin: 0;
		font-size: var(--t-13);
		line-height: 1.55;
		color: var(--text-muted);
	}

	.album-sheet-progress {
		margin-top: 1.1rem;
	}

	.album-sheet-progress-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.4rem;
	}

	.album-sheet-progress-value {
		font-size: var(--t-11, 0.7rem);
		color: var(--laurel);
		letter-spacing: var(--tracking-allcaps);
	}

	.album-sheet-progress-bar {
		height: 4px;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-base) 8%, transparent);
		overflow: hidden;
	}

	.album-sheet-progress-bar > span {
		display: block;
		height: 100%;
		background: var(--laurel);
		transition: width 360ms ease;
	}
</style>
