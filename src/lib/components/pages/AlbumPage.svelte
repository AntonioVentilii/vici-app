<script lang="ts">
	import { X } from 'lucide-svelte/icons';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import type { AchievementTier } from '$lib/constants/achievements.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import { evaluateAchievements, type AchievementEvaluation } from '$lib/utils/achievements.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { goBack } from '$lib/utils/nav.utils';

	/**
	 * Album — milestone awards / stickers gallery. Reached as a profile
	 * sub-route. Renders every achievement defined in `ACHIEVEMENTS` as a
	 * circular metallic medallion in a 3-column grid; each tile carries
	 * the achievement's unicode glyph emblem (◎ ★ ⚡ ⧖ ◐ ⌘ ✦ ◉ ✧) over a
	 * tier fill (gold / silver / bronze). The inset bevel ring + diagonal
	 * shine sweep give the disc its metallic relief. Tapping a tile slides
	 * up a bottom-sheet with the full prose detail + a progress bar for
	 * the unearned ones.
	 *
	 * Tiles render in one of three states:
	 *   - earned       — full metallic medallion in its tier colour.
	 *   - in progress  — locked (dark) medallion with a thin accent
	 *                    progress bar across the foot, sized to how close
	 *                    the user is to unlocking.
	 *   - locked       — untouched dark medallion (progress 0), no bar.
	 *
	 * Ordering is closest-to-unlock first: in-progress tiles lead (highest
	 * progress first), then earned, then untouched-locked — mirroring the
	 * profile achievement rail so the affordance carries across surfaces.
	 *
	 * Earned state is sticky: it honours the profile's persisted
	 * `unlockedAchievements` set (`persistedUnlocks.has(id) ||
	 * evaluation.unlocked`), so an award never visually rescinds after a
	 * streak regresses — append-only, exactly like the profile rail.
	 *
	 * Progress is sourced from the user's live profile via
	 * `evaluateAchievements` — the same engine that fires the one-shot
	 * unlock toasts during normal trading. `sharpest-eye` reflects the
	 * persisted gold/silver/bronze tier from `sharpestEyeBestTier`; every
	 * other award uses its static `def.tier`.
	 */

	const persistedUnlocks = $derived(new Set($userStore.profile?.unlockedAchievements ?? []));

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
			contrarianWins: profile.contrarianWins ?? 0,
			// `league-founder`'s live axis needs league membership the album
			// store doesn't carry; the sticky persisted unlock drives the
			// earned state, so the live flag stays `false` here.
			ownsQualifyingLeague: false,
			topDecileStreak: profile.topDecileStreak ?? 0,
			// Monthly awards: `sharpest-eye`'s tier comes from the persisted
			// best tier; `bold-caller`'s live axis is the sticky persisted
			// unlock (the album store doesn't recompute monthly leaderboards —
			// `getMonthlyLeaderboard` runs on the profile-sync path that
			// persists `sharpestEyeBestTier` + appends `bold-caller`).
			sharpestEyeBestTier: profile.sharpestEyeBestTier,
			wonBoldCallerMonth: (profile.unlockedAchievements ?? []).includes('bold-caller')
		});
	});

	// Effective earned state — sticky: a persisted unlock keeps the
	// medallion lit even if the live axis regressed (parity with the
	// profile achievement rail).
	const isEarned = (e: AchievementEvaluation): boolean => persistedUnlocks.has(e.id) || e.unlocked;

	const isInProgress = (e: AchievementEvaluation): boolean => !isEarned(e) && e.progress > 0;

	// `sharpest-eye` is the one award whose live wash isn't its static
	// `def.tier`: the podium tier (gold / silver / bronze) is carried by
	// the profile's `sharpestEyeBestTier`. Everything else uses `def.tier`.
	const tierFor = (e: AchievementEvaluation): AchievementTier => {
		if (e.id === 'sharpest-eye') {
			const best = $userStore.profile?.sharpestEyeBestTier;

			if (best === 'gold' || best === 'silver' || best === 'bronze') {
				return best;
			}
		}

		return e.def.tier;
	};

	// Closest-to-unlock first: in-progress (locked w/ progress) sorted by
	// progress desc, then earned, then untouched-locked. Mirrors the
	// profile rail's sort with the sticky earned bucket folded behind.
	const ordered = $derived.by((): AchievementEvaluation[] => {
		const bucket = (e: AchievementEvaluation): number => {
			if (isEarned(e)) {
				return 1;
			}

			return e.progress > 0 ? 0 : 2;
		};

		return [...evaluations].sort((a, b) => {
			const byBucket = bucket(a) - bucket(b);

			if (byBucket !== 0) {
				return byBucket;
			}

			return b.progress - a.progress;
		});
	});

	const earned = $derived(evaluations.filter((e) => isEarned(e)).length);
	const total = $derived(evaluations.length);

	let openTarget = $state<AchievementEvaluation | null>(null);

	const openTargetEarned = $derived(openTarget !== null && isEarned(openTarget));
	const openTargetTier = $derived(openTarget === null ? 'gold' : tierFor(openTarget));
</script>

<div class="album-page">
	<MobileAppBar
		align="center"
		back={{
			label: t({ locale: $localeStore, key: 'album.back' }),
			onBack: () => goBack(resolve(AppPath.Profile))
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
		{#each ordered as evaluation (evaluation.id)}
			{@const tier = tierFor(evaluation)}
			<button
				class="award"
				class:bronze={tier === 'bronze'}
				class:gold={tier === 'gold'}
				class:in-progress={isInProgress(evaluation)}
				class:locked={!isEarned(evaluation)}
				class:silver={tier === 'silver'}
				onclick={() => (openTarget = evaluation)}
				type="button"
			>
				<span class="emblem" aria-hidden="true">
					{evaluation.def.emblem}
				</span>
				<span class="title">
					{t({ locale: $localeStore, key: evaluation.def.nameKey })}
				</span>
				<span class="sub">
					{t({ locale: $localeStore, key: evaluation.def.descriptionKey })}
				</span>
				{#if isInProgress(evaluation)}
					<span
						class="award-progress"
						aria-valuemax="100"
						aria-valuemin="0"
						aria-valuenow={Math.round(evaluation.progress * 100)}
						role="progressbar"
					>
						<span style:width={`${evaluation.progress * 100}%`}></span>
					</span>
				{/if}
			</button>
		{/each}
	</div>

	{#if openTarget}
		<!--
			Position the sheet backdrop ABSOLUTELY within the .album-page
			container (not `position: fixed` on the viewport) so the modal
			swims inside the screen-scroll surface.
		-->
		<div
			class="album-sheet-backdrop"
			aria-label={t({ locale: $localeStore, key: 'album.close' })}
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
						class:album-sheet-earned={openTargetEarned}
						class:album-sheet-locked={!openTargetEarned}
					>
						{t({
							locale: $localeStore,
							key: openTargetEarned ? 'album.awarded' : 'album.locked'
						})}
					</span>
					<button
						class="album-sheet-close"
						aria-label={t({ locale: $localeStore, key: 'album.close' })}
						onclick={() => (openTarget = null)}
						type="button"
					>
						<X size={14} strokeWidth={1.8} />
					</button>
				</div>

				<div class="album-sheet-body">
					<div
						class="award album-sheet-emblem"
						class:bronze={openTargetTier === 'bronze'}
						class:gold={openTargetTier === 'gold'}
						class:locked={!openTargetEarned}
						class:silver={openTargetTier === 'silver'}
						aria-hidden="true"
					>
						<span class="emblem">{openTarget.def.emblem}</span>
					</div>
					<div>
						<div class="album-sheet-title">
							{t({ locale: $localeStore, key: openTarget.def.nameKey })}
						</div>
						<div class="album-sheet-sub allcaps num">
							{t({ locale: $localeStore, key: openTarget.def.descriptionKey })}
						</div>
					</div>
				</div>

				<p class="album-sheet-detail">
					{t({ locale: $localeStore, key: openTarget.def.detailKey })}
				</p>

				{#if !openTargetEarned}
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
</div>

<style lang="postcss">
	.album-page {
		position: relative;
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
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.album-progress-label {
		color: var(--color-primary);
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
		background: var(--color-primary);
		transition: width 360ms ease;
	}

	.album-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
	}

	/* Award medallion — a circular metallic disc with a raised bevel.
	   The glyph + title + sub sit centred above the disc; a thin accent
	   bar appears across the foot when the award is in progress.
	   Gold is the default tier; silver / bronze + locked re-tint the
	   radial fill. The ::before ring + ::after shine sweep give the disc
	   its metallic relief. */
	.award {
		appearance: none;
		border: 0;
		cursor: pointer;
		font-family: inherit;
		color: inherit;
		aspect-ratio: 1 / 1;
		position: relative;
		border-radius: 50%;
		background: radial-gradient(
			circle at 30% 30%,
			rgba(226, 184, 66, 0.85) 0%,
			rgba(182, 139, 31, 0.95) 50%,
			rgba(120, 90, 18, 0.95) 100%
		);
		box-shadow:
			0 10px 24px -10px rgba(0, 0, 0, 0.6),
			inset 0 2px 0 rgba(255, 255, 255, 0.2),
			inset 0 -3px 0 rgba(0, 0, 0, 0.25);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 14% 12% 16%;
		isolation: isolate;
		overflow: hidden;
		transition: transform 140ms ease;
	}

	/* Only the interactive grid medallions (buttons) lift on hover — not the
	   static detail-sheet emblem, which reuses the `.award` class. */
	button.award:hover {
		transform: translateY(-1px);
	}

	.award::before {
		content: '';
		position: absolute;
		inset: 8%;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 50%;
		z-index: 0;
	}

	.award::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			135deg,
			transparent 30%,
			rgba(255, 255, 255, 0.2) 48%,
			rgba(255, 255, 255, 0.06) 52%,
			transparent 60%
		);
		z-index: 1;
		pointer-events: none;
	}

	.award .emblem {
		position: relative;
		z-index: 2;
		font-size: 26px;
		color: rgba(60, 40, 8, 0.9);
		line-height: 1;
		margin-bottom: 4px;
	}

	/* Source uses ~8.5px / 7.5px mono labels for tight on-disc legibility.
	   Kept source-exact for visual parity; `text-wrap: balance` + no
	   truncation lets the longest translated titles (DE "Schärfster
	   Blick", PT "Olhar mais afiado", FR "Premier pronostic") wrap onto a
	   second/third line rather than clip. */
	.award .title {
		position: relative;
		z-index: 2;
		font-family: var(--font-mono);
		font-size: 8.5px;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(40, 28, 4, 0.95);
		line-height: 1.15;
		text-wrap: balance;
		overflow-wrap: anywhere;
	}

	.award .sub {
		position: relative;
		z-index: 2;
		font-family: var(--font-mono);
		font-size: 7.5px;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: rgba(40, 28, 4, 0.7);
		margin-top: 2px;
		text-wrap: balance;
		overflow-wrap: anywhere;
	}

	.award.silver {
		background: radial-gradient(
			circle at 30% 30%,
			rgba(214, 218, 223, 0.9) 0%,
			rgba(160, 166, 175, 0.95) 50%,
			rgba(100, 106, 115, 0.95) 100%
		);
	}

	.award.silver .emblem,
	.award.silver .title,
	.award.silver .sub {
		color: rgba(28, 32, 40, 0.9);
	}

	.award.bronze {
		background: radial-gradient(
			circle at 30% 30%,
			rgba(196, 138, 90, 0.92) 0%,
			rgba(148, 98, 58, 0.96) 50%,
			rgba(96, 62, 30, 0.96) 100%
		);
	}

	.award.bronze .emblem,
	.award.bronze .title,
	.award.bronze .sub {
		color: rgba(36, 22, 8, 0.92);
	}

	.award.locked {
		background: radial-gradient(
			circle at 30% 30%,
			rgba(80, 80, 86, 0.85) 0%,
			rgba(50, 50, 56, 0.95) 50%,
			rgba(28, 28, 32, 0.95) 100%
		);
		box-shadow:
			0 6px 14px -8px rgba(0, 0, 0, 0.45),
			inset 0 2px 0 rgba(255, 255, 255, 0.06),
			inset 0 -3px 0 rgba(0, 0, 0, 0.3);
	}

	.award.locked::after {
		background: linear-gradient(
			135deg,
			transparent 30%,
			rgba(255, 255, 255, 0.06) 48%,
			transparent 60%
		);
	}

	.award.locked .emblem {
		color: rgba(242, 236, 220, 0.3);
	}

	.award.locked .title {
		color: rgba(242, 236, 220, 0.55);
	}

	.award.locked .sub {
		color: rgba(242, 236, 220, 0.35);
	}

	/* In-progress accent bar across the foot of a locked medallion —
	   visually distinguishes "on the way" tiles from untouched ones. */
	.award-progress {
		position: absolute;
		z-index: 2;
		left: 22%;
		right: 22%;
		bottom: 14%;
		height: 3px;
		border-radius: var(--r-pill);
		background: rgba(242, 236, 220, 0.18);
		overflow: hidden;
	}

	.award-progress > span {
		display: block;
		height: 100%;
		border-radius: var(--r-pill);
		background: var(--color-primary);
		transition: width 360ms ease;
	}

	/* Bottom-sheet positioned ABSOLUTELY within the .album-page
	   container so it swims inside the screen-scroll surface. */
	.album-sheet-backdrop {
		position: absolute;
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
		box-shadow: 0 -20px 60px -20px rgba(0, 0, 0, 0.5);
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
		color: var(--color-primary);
	}

	.album-sheet-locked {
		color: var(--text-muted);
	}

	.album-sheet-close {
		appearance: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 6px 10px;
		background: none;
		border: 0;
		color: var(--text-muted);
		cursor: pointer;
	}

	.album-sheet-body {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		margin-bottom: 0.9rem;
	}

	/* 64×64 medallion inside the modal — reuses .award fill but at a
	   fixed size, no hover, no progress bar. */
	.album-sheet-emblem {
		width: 64px;
		height: 64px;
		aspect-ratio: auto;
		padding: 0;
		flex-shrink: 0;
		cursor: default;
	}

	.album-sheet-emblem .emblem {
		font-size: 30px;
		margin-bottom: 0;
	}

	.album-sheet-title {
		font-size: 19px;
		font-weight: 600;
		letter-spacing: var(--tracking-snug);
		color: var(--text-base);
	}

	.album-sheet-sub {
		font-size: var(--t-11);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-top: 0.15rem;
	}

	.album-sheet-detail {
		margin: 0;
		font-size: var(--t-13);
		line-height: 1.6;
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
		font-size: var(--t-11);
		color: var(--color-primary);
		letter-spacing: 0.06em;
		text-transform: uppercase;
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
		background: var(--color-primary);
		transition: width 360ms ease;
	}

	@media (prefers-reduced-motion: reduce) {
		.award,
		.award-progress > span,
		.album-progress-bar > span,
		.album-sheet-progress-bar > span {
			transition: none;
		}
	}
</style>
