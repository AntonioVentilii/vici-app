<script lang="ts">
	import { X } from '@lucide/svelte/icons';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import ScreenHeader from '$lib/components/layout/ScreenHeader.svelte';
	import MenagerieBadge from '$lib/components/menagerie/MenagerieBadge.svelte';
	import { MENAGERIE_TIER_RANK, type MenagerieSlug } from '$lib/constants/menagerie.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { listMyReferrals } from '$lib/services/referral.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { globalStandingsStore } from '$lib/stores/standings.store';
	import { userStore } from '$lib/stores/user.store';
	import { t } from '$lib/utils/i18n.utils';
	import {
		menagerieConceptKey,
		menagerieRows,
		menagerieStatsFromProfile,
		menagerieTierColor,
		type MenagerieRow
	} from '$lib/utils/menagerie.utils';
	import { goBack } from '$lib/utils/nav.utils';

	/**
	 * The Menagerie — the achievement trophy layer. Reached as a profile
	 * sub-route. Renders all twelve animals as squircle badges in a 3-column
	 * grid (earned first, then locked-by-progress), each with the animal's
	 * current tier derived live from the owner's real stats. Tapping a badge
	 * slides up a detail sheet: the tier ladder, current progress, and the
	 * animal's concept / rule.
	 *
	 * Animals whose metric reads a stat the backend does not yet populate
	 * (Raven / Octopus / Magpie / Bee) resolve to LOCKED and show as "soon"
	 * tiles — see the per-hook notes in `$lib/utils/menagerie.utils`.
	 */

	// Referral count (Parrot) — loaded once; the profile doc doesn't carry it.
	let referralCount = $state(0);

	onMount(() => {
		void (async () => {
			try {
				const referrals = await listMyReferrals();
				referralCount = referrals.length;
			} catch {
				// Best-effort: Parrot just stays at its baseline if this fails.
			}
		})();
	});

	// Global rank (Goat) from the cached "all" leaderboard window, if loaded.
	const selfRank = $derived.by((): { rank: number; total: number } | undefined => {
		const result = $globalStandingsStore.get('all');
		const owner = $userStore.profile?.owner;

		if (!result || !owner) {
			return;
		}

		const self = result.entries.find((entry) => entry.owner === owner);

		if (!self) {
			return;
		}

		return { rank: self.rank, total: result.entries.length };
	});

	const stats = $derived(
		menagerieStatsFromProfile({
			profile: $userStore.profile,
			signals: {
				referrals: referralCount,
				rank: selfRank?.rank,
				totalRanked: selfRank?.total
			}
		})
	);

	const rows = $derived(menagerieRows(stats));
	const earned = $derived(rows.filter((row) => row.tier !== null).length);
	const total = $derived(rows.length);

	let openSlug = $state<MenagerieSlug | null>(null);
	const openRow = $derived.by((): MenagerieRow | null =>
		openSlug === null ? null : (rows.find((row) => row.animal.slug === openSlug) ?? null)
	);
</script>

<div class="menagerie-page">
	<ScreenHeader
		back={{
			label: t({ locale: $localeStore, key: 'menagerie.back' }),
			onBack: () => goBack(resolve(AppPath.Profile))
		}}
		title={t({ locale: $localeStore, key: 'menagerie.title' })}
	/>

	<section class="men-progress">
		<span class="eyebrow men-progress-label">
			{t({ locale: $localeStore, key: 'menagerie.collection' })}
		</span>
		<div class="men-progress-counts">
			<span class="num men-progress-earned">{earned}</span>
			<span class="men-progress-of">
				{t({ locale: $localeStore, key: 'menagerie.earned_of', params: { total } })}
			</span>
		</div>
		<div
			class="men-progress-bar"
			aria-valuemax={total}
			aria-valuemin="0"
			aria-valuenow={earned}
			role="progressbar"
		>
			<span style:width={`${total === 0 ? 0 : (earned / total) * 100}%`}></span>
		</div>
	</section>

	<div class="men-grid">
		{#each rows as row, i (row.animal.slug)}
			{@const { tier } = row}
			{@const earnedOne = tier !== null}
			{@const conceptKey = menagerieConceptKey({ slug: row.animal.slug, tier })}
			<button
				style:--ti={i}
				class="men-tile"
				class:is-earned={earnedOne}
				onclick={() => (openSlug = row.animal.slug)}
				type="button"
			>
				<MenagerieBadge size={84} slug={row.animal.slug} {stats} {tier} />
				<span class="men-tile-name">{t({ locale: $localeStore, key: row.animal.nameKey })}</span>
				<span
					style:color={earnedOne ? menagerieTierColor(tier) : 'var(--text-muted)'}
					class="men-tile-concept"
				>
					{#if earnedOne && conceptKey}
						{t({ locale: $localeStore, key: conceptKey })}
					{:else}
						{t({ locale: $localeStore, key: 'menagerie.locked' })}
					{/if}
				</span>
			</button>
		{/each}
	</div>

	{#if openRow}
		{@const row = openRow}
		{@const { tier } = row}
		{@const earnedOne = tier !== null}
		{@const { progress } = row}
		<div
			class="men-sheet-backdrop"
			aria-label={t({ locale: $localeStore, key: 'menagerie.close' })}
			onclick={() => (openSlug = null)}
			onkeydown={(e) => {
				if (e.key === 'Escape' || e.key === 'Enter') {
					openSlug = null;
				}
			}}
			role="button"
			tabindex="0"
		>
			<div
				class="men-sheet"
				aria-modal="true"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
				role="dialog"
				tabindex="-1"
			>
				<div class="men-sheet-head">
					<span
						style:color={earnedOne ? menagerieTierColor(tier) : 'var(--text-muted)'}
						class="eyebrow"
						class:men-sheet-earned={earnedOne}
						class:men-sheet-locked={!earnedOne}
					>
						{#if earnedOne}
							{t({ locale: $localeStore, key: `menagerie.tier.${tier}` as const })}
							·
							{t({
								locale: $localeStore,
								key: menagerieConceptKey({ slug: row.animal.slug, tier }) ?? row.animal.conceptKey
							})}
						{:else}
							{t({ locale: $localeStore, key: 'menagerie.locked' })}
						{/if}
					</span>
					<button
						class="men-sheet-close"
						aria-label={t({ locale: $localeStore, key: 'menagerie.close' })}
						onclick={() => (openSlug = null)}
						type="button"
					>
						<X size={14} strokeWidth={1.8} />
					</button>
				</div>

				<div class="men-sheet-body">
					<MenagerieBadge size={92} slug={row.animal.slug} {stats} {tier} />
					<div>
						<div class="men-sheet-title">
							{t({ locale: $localeStore, key: row.animal.nameKey })}
						</div>
						<div class="men-sheet-oracle">
							“{t({ locale: $localeStore, key: row.animal.oracleKey })}”
						</div>
					</div>
				</div>

				<p class="men-sheet-rule">
					{t({ locale: $localeStore, key: row.animal.ruleKey })}
				</p>

				<!-- Tier ladder -->
				<div class="men-ladder">
					{#each row.animal.tiers as step, idx (step.tier)}
						{@const reached = tier ? MENAGERIE_TIER_RANK[tier] : 0}
						{@const on = MENAGERIE_TIER_RANK[step.tier] <= reached}
						{@const isCurrent = step.tier === tier}
						<div class="men-step" class:is-current={isCurrent} class:is-reached={on}>
							<span
								style:background={on ? menagerieTierColor(step.tier) : undefined}
								class="men-step-dot"
							></span>
							<span class="men-step-tier">
								{t({ locale: $localeStore, key: `menagerie.tier.${step.tier}` as const })}
							</span>
							<span class="men-step-goal">
								{t({ locale: $localeStore, key: row.animal.labelKeys[idx] })}
							</span>
						</div>
					{/each}
				</div>

				{#if progress && progress.next !== null}
					<div class="men-sheet-progress">
						<div class="men-sheet-progress-head">
							<span class="eyebrow">
								{t({
									locale: $localeStore,
									key: earnedOne ? 'menagerie.next_tier' : 'menagerie.progress'
								})}
							</span>
							<span class="num men-sheet-progress-value">
								{Math.round(progress.ratio * 100)}%
							</span>
						</div>
						<div class="men-sheet-progress-bar">
							<span
								style:width={`${Math.round(progress.ratio * 100)}%`}
								style:background={earnedOne ? menagerieTierColor(tier) : 'var(--color-primary)'}
							></span>
						</div>
					</div>
				{:else if earnedOne}
					<div class="men-maxed">
						{t({ locale: $localeStore, key: 'menagerie.fully_evolved' })}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style lang="postcss">
	.menagerie-page {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0 1.25rem 6rem;
	}

	.men-progress {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.9rem 1rem;
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.men-progress-label {
		color: var(--color-primary);
	}

	.men-progress-counts {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.men-progress-earned {
		font-size: var(--t-28, 1.75rem);
		font-weight: 700;
		color: var(--text-base);
	}

	.men-progress-of {
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.men-progress-bar {
		position: relative;
		height: 4px;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-base) 8%, transparent);
		overflow: hidden;
	}

	.men-progress-bar > span {
		display: block;
		height: 100%;
		background: var(--color-primary);
		transition: width 360ms ease;
	}

	.men-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}

	.men-tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 18px 8px 16px;
		border-radius: 16px;
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		appearance: none;
		cursor: pointer;
		font-family: inherit;
		color: inherit;
		transition:
			transform 0.12s ease,
			border-color 0.12s ease;
		/* staggered grid reveal — the collection blooms in rather than dumping */
		animation: men-tile-in 0.44s cubic-bezier(0.2, 0.7, 0.2, 1) both;
		animation-delay: calc(var(--ti, 0) * 34ms);
	}

	.men-tile:hover {
		transform: translateY(-2px);
		border-color: color-mix(in srgb, var(--text-base) 18%, transparent);
	}

	.men-tile:active {
		transform: translateY(0);
	}

	@keyframes men-tile-in {
		from {
			opacity: 0;
			transform: translateY(14px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.men-tile-name {
		margin-top: 12px;
		font-size: var(--t-13);
		font-weight: 600;
		text-align: center;
	}

	.men-tile-concept {
		margin-top: 3px;
		font-family: var(--font-mono);
		font-size: var(--t-11);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-align: center;
	}

	/* ── Detail sheet ── */
	.men-sheet-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(14, 13, 11, 0.78);
		backdrop-filter: blur(10px);
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		z-index: 80;
	}

	.men-sheet {
		background: var(--bg-surface);
		border-top-left-radius: 22px;
		border-top-right-radius: 22px;
		border-top: 1px solid var(--border-base);
		padding: 1.4rem 1.4rem calc(1.4rem + env(safe-area-inset-bottom, 0px));
		box-shadow: 0 -20px 60px -20px rgba(0, 0, 0, 0.5);
		max-height: 86vh;
		overflow-y: auto;
	}

	.men-sheet-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.men-sheet-close {
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

	.men-sheet-body {
		display: flex;
		align-items: center;
		gap: 1.1rem;
		margin-bottom: 1.1rem;
	}

	.men-sheet-title {
		font-size: 22px;
		font-weight: 600;
		letter-spacing: var(--tracking-snug);
		color: var(--text-base);
	}

	.men-sheet-oracle {
		font-family: var(--font-serif, Georgia, serif);
		font-style: italic;
		font-size: 15px;
		color: var(--text-muted);
		margin-top: 3px;
	}

	.men-sheet-rule {
		margin: 0 0 1.25rem;
		font-size: var(--t-13);
		line-height: 1.6;
		color: var(--text-muted);
	}

	.men-ladder {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: 6px;
		position: relative;
	}

	.men-ladder::before {
		content: '';
		position: absolute;
		left: 8%;
		right: 8%;
		top: 5px;
		height: 2px;
		background: color-mix(in srgb, var(--text-base) 10%, transparent);
		z-index: 0;
	}

	.men-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		text-align: center;
		position: relative;
		z-index: 1;
	}

	.men-step-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--text-base) 16%, transparent);
		box-shadow: 0 0 0 3px var(--bg-surface);
	}

	.men-step.is-current .men-step-dot {
		box-shadow:
			0 0 0 3px var(--bg-surface),
			0 0 0 5px color-mix(in srgb, var(--text-base) 20%, transparent);
	}

	.men-step-tier {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-family: var(--font-mono);
		color: var(--text-muted);
	}

	.men-step.is-reached .men-step-tier {
		color: var(--text-base);
	}

	.men-step-goal {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
	}

	.men-step.is-reached .men-step-goal {
		color: var(--text-base);
	}

	.men-sheet-progress {
		margin-top: 1.25rem;
	}

	.men-sheet-progress-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.4rem;
	}

	.men-sheet-progress-value {
		font-size: var(--t-11);
		color: var(--color-primary);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.men-sheet-progress-bar {
		height: 4px;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-base) 8%, transparent);
		overflow: hidden;
	}

	.men-sheet-progress-bar > span {
		display: block;
		height: 100%;
		border-radius: var(--r-pill);
		transition: width 360ms ease;
	}

	.men-maxed {
		margin-top: 1.1rem;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--laurel, var(--color-primary));
	}

	@media (prefers-reduced-motion: reduce) {
		.men-tile {
			animation: none;
			transition: none;
		}

		.men-progress-bar > span,
		.men-sheet-progress-bar > span {
			transition: none;
		}
	}
</style>
