<script lang="ts">
	import { X } from 'lucide-svelte/icons';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import { evaluateAchievements, type AchievementEvaluation } from '$lib/utils/achievements.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { goBack } from '$lib/utils/nav.utils';

	/**
	 * Album — milestone awards / stickers gallery, port of the design
	 * source's `AlbumScreen` (`screens.jsx:4650`). Reached as a profile
	 * sub-route. Renders every achievement defined in `ACHIEVEMENTS` as
	 * a tile in a 3-column grid; each tile carries the achievement's
	 * unicode glyph emblem (◎ ★ ⚡ ⧖ ◐ ⌘) and tier wash
	 * (gold / silver / bronze). Tapping a tile slides up a bottom-sheet
	 * with the full prose detail + a progress bar for the unearned
	 * ones.
	 *
	 * Progress is sourced from the user's live profile via
	 * `evaluateAchievements` — same engine that fires the one-shot
	 * unlock toasts during normal trading.
	 */

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
		{#each evaluations as evaluation (evaluation.id)}
			<button
				class="album-award"
				class:is-bronze={evaluation.def.tier === 'bronze'}
				class:is-gold={evaluation.def.tier === 'gold'}
				class:is-locked={!evaluation.unlocked}
				class:is-silver={evaluation.def.tier === 'silver'}
				onclick={() => (openTarget = evaluation)}
				type="button"
			>
				<span class="album-award-emblem" aria-hidden="true">
					{evaluation.def.emblem}
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

	{#if openTarget}
		<!--
			Position the sheet backdrop ABSOLUTELY within the .album-page
			container (not `position: fixed` on the viewport) so the
			modal swims inside the screen-scroll surface — mirroring
			`screens.jsx:4720-4757` exactly.
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
						<X size={14} strokeWidth={1.8} />
					</button>
				</div>

				<div class="album-sheet-body">
					<div
						class="album-sheet-emblem"
						class:is-bronze={openTarget.def.tier === 'bronze'}
						class:is-gold={openTarget.def.tier === 'gold'}
						class:is-locked={!openTarget.unlocked}
						class:is-silver={openTarget.def.tier === 'silver'}
						aria-hidden="true"
					>
						{openTarget.def.emblem}
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
		gap: 0.65rem;
	}

	/* Award tile — a square card with a glyph emblem centred above
	   the title + sub. Tier classes wash the emblem in their accent
	   colour; .is-locked drops opacity to 0.5. */
	.album-award {
		appearance: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		padding: 0.95rem 0.5rem;
		font: inherit;
		text-align: center;
		color: var(--text-base);
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		cursor: pointer;
		transition:
			transform 140ms ease,
			border-color 140ms ease,
			background-color 140ms ease;
	}

	.album-award:hover {
		transform: translateY(-1px);
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
		font-size: 26px;
		line-height: 1;
		color: var(--text-base);
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

	/* Tier washes — gold uses the laurel-accent (our `--color-primary`),
	   silver + bronze keep their canonical metallic tones. */
	.album-award.is-gold {
		border-color: color-mix(in srgb, #f4c544 35%, var(--border-base));
		background: color-mix(in srgb, #f4c544 5%, var(--bg-surface));
	}

	.album-award.is-gold .album-award-emblem {
		color: #f4c544;
	}

	.album-award.is-silver {
		border-color: color-mix(in srgb, #c0c5cc 35%, var(--border-base));
		background: color-mix(in srgb, #c0c5cc 5%, var(--bg-surface));
	}

	.album-award.is-silver .album-award-emblem {
		color: #c0c5cc;
	}

	.album-award.is-bronze {
		border-color: color-mix(in srgb, #c97c4a 35%, var(--border-base));
		background: color-mix(in srgb, #c97c4a 5%, var(--bg-surface));
	}

	.album-award.is-bronze .album-award-emblem {
		color: #c97c4a;
	}

	.album-award.is-locked .album-award-emblem,
	.album-award.is-locked .album-award-title,
	.album-award.is-locked .album-award-sub {
		filter: grayscale(0.8);
	}

	/* Bottom-sheet positioned ABSOLUTELY within the .album-page
	   container so it swims inside the screen-scroll surface — see
	   `screens.jsx:4720`. */
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

	/* 64×64 tier-styled emblem tile inside the modal — matches
	   `screens.jsx:4733-4735` `<div className="award ${tier}">`. */
	.album-sheet-emblem {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		font-size: 30px;
		line-height: 1;
		border: 1px solid var(--border-base);
		border-radius: 14px;
		color: var(--text-base);
		flex-shrink: 0;
	}

	.album-sheet-emblem.is-gold {
		border-color: color-mix(in srgb, #f4c544 45%, var(--border-base));
		background: color-mix(in srgb, #f4c544 10%, var(--bg-surface));
		color: #f4c544;
	}

	.album-sheet-emblem.is-silver {
		border-color: color-mix(in srgb, #c0c5cc 45%, var(--border-base));
		background: color-mix(in srgb, #c0c5cc 10%, var(--bg-surface));
		color: #c0c5cc;
	}

	.album-sheet-emblem.is-bronze {
		border-color: color-mix(in srgb, #c97c4a 45%, var(--border-base));
		background: color-mix(in srgb, #c97c4a 10%, var(--bg-surface));
		color: #c97c4a;
	}

	.album-sheet-emblem.is-locked {
		filter: grayscale(0.85);
		opacity: 0.6;
	}

	.album-sheet-title {
		font-size: 19px;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text-base);
	}

	.album-sheet-sub {
		font-size: var(--t-11, 0.7rem);
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
		font-size: var(--t-11, 0.7rem);
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
		.album-award,
		.album-progress-bar > span,
		.album-sheet-progress-bar > span {
			transition: none;
		}
	}
</style>
