<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { functions } from '$declarations/satellite/satellite.api';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import {
		lookupWorldsAffiliation,
		WORLDS_COUNTRIES,
		WORLDS_UNIVERSITIES
	} from '$lib/constants/worlds-affiliations.constants';
	import { getAffiliationStats } from '$lib/services/worlds.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { AffiliationKind } from '$lib/types/affiliation';
	import { MIN_CALLS_FOR_RANK, type AffiliationStatsDoc } from '$lib/types/affiliation-stats';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Worlds affiliation detail — drill-down from `WorldsPage`. Shows
	 * the identity card (name + glyph), member count from the live
	 * `listWorldsRoster` query, and the per-affiliation accuracy +
	 * rank stats from `getAffiliationStats`.
	 *
	 * Stats are populated lazily by the satellite hook on `profiles`
	 * updates — a new affiliation with zero resolved trades returns
	 * `stats === undefined`, and the panel renders an "unranked"
	 * placeholder until the first resolution event lands.
	 */
	interface Props {
		kind: AffiliationKind;
		affiliationId: string;
	}

	const { kind, affiliationId }: Props = $props();

	const option = $derived(lookupWorldsAffiliation({ kind, id: affiliationId }));
	const rosterSize = $derived(
		kind === 'university' ? WORLDS_UNIVERSITIES.length : WORLDS_COUNTRIES.length
	);

	let memberCount = $state<number | undefined>();
	let stats = $state<AffiliationStatsDoc | undefined>();
	let loadState: 'loading' | 'ready' | 'error' = $state('loading');
	let errorMessage: string | null = $state(null);

	onMount(async () => {
		try {
			const [rosterResp, statsResp] = await Promise.all([
				functions.listWorldsRoster({ kind, affiliationId }),
				getAffiliationStats({ kind, affiliationId })
			]);
			memberCount = rosterResp.items.length;
			stats = statsResp;
			loadState = 'ready';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
			loadState = 'error';
		}
	});

	const accuracyPctLifetime = $derived(
		stats && stats.totalCalls > 0 ? Math.round((stats.wins / stats.totalCalls) * 1000) / 10 : 0
	);

	const accuracyPctMonth = $derived(
		stats && stats.monthTotalCalls > 0
			? Math.round((stats.monthWins / stats.monthTotalCalls) * 1000) / 10
			: 0
	);

	const ranked = $derived(stats !== undefined && stats.totalCalls >= MIN_CALLS_FOR_RANK);

	const backToWorlds = () => {
		void goto(`${resolve('/social')}/worlds`);
	};

	const openFlow = () => {
		void goto(resolve('/flow'));
	};
</script>

<div class="worlds-detail">
	<MobileAppBar
		align="left"
		back={{
			label: t({ locale: $localeStore, key: 'worlds.detail.back' }),
			onBack: backToWorlds
		}}
		title={option?.name ?? affiliationId}
	/>

	<section class="worlds-detail-identity">
		<span class="worlds-detail-glyph" aria-hidden="true">{option?.glyph ?? '?'}</span>
		<div class="worlds-detail-identity-text">
			<span class="worlds-detail-identity-name">{option?.name ?? affiliationId}</span>
			<span class="num allcaps worlds-detail-identity-meta">
				{#if loadState === 'loading'}
					{t({ locale: $localeStore, key: 'worlds.detail.loading_members' })}
				{:else if memberCount !== undefined}
					{t({
						locale: $localeStore,
						key: 'worlds.detail.members_count',
						params: { count: memberCount }
					})}
				{/if}
			</span>
		</div>
	</section>

	<section class="worlds-detail-stats">
		<h2 class="eyebrow worlds-detail-stats-title">
			{t({ locale: $localeStore, key: 'worlds.detail.stats_eyebrow' })}
		</h2>

		{#if !stats || stats.totalCalls === 0}
			<p class="worlds-detail-stats-hint">
				{t({ locale: $localeStore, key: 'worlds.detail.stats_empty' })}
			</p>
		{:else}
			<div class="worlds-detail-stats-grid">
				<div class="worlds-detail-stats-cell">
					<span class="num allcaps worlds-detail-stats-label">
						{t({ locale: $localeStore, key: 'worlds.detail.stats_month' })}
					</span>
					<span class="num worlds-detail-stats-value">
						{stats.monthTotalCalls === 0 ? '—' : `${accuracyPctMonth}%`}
					</span>
					<span class="num allcaps worlds-detail-stats-sub">
						{t({
							locale: $localeStore,
							key: 'worlds.detail.stats_calls_month',
							params: { count: stats.monthTotalCalls }
						})}
					</span>
				</div>
				<div class="worlds-detail-stats-cell">
					<span class="num allcaps worlds-detail-stats-label">
						{t({ locale: $localeStore, key: 'worlds.detail.stats_lifetime' })}
					</span>
					<span class="num worlds-detail-stats-value">{accuracyPctLifetime}%</span>
					<span class="num allcaps worlds-detail-stats-sub">
						{t({
							locale: $localeStore,
							key: 'worlds.detail.stats_calls_lifetime',
							params: { count: stats.totalCalls }
						})}
					</span>
				</div>
			</div>
			{#if !ranked}
				<p class="num allcaps worlds-detail-stats-unranked">
					{t({
						locale: $localeStore,
						key: 'worlds.detail.stats_unranked',
						params: { min: MIN_CALLS_FOR_RANK }
					})}
				</p>
			{/if}
		{/if}
	</section>

	<button class="worlds-detail-cta" onclick={openFlow} type="button">
		<div class="worlds-detail-cta-text">
			<span class="eyebrow worlds-detail-cta-eyebrow">
				{t({ locale: $localeStore, key: 'worlds.detail.cta_eyebrow' })}
			</span>
			<span class="worlds-detail-cta-label">
				{t({ locale: $localeStore, key: 'worlds.detail.cta_label' })}
			</span>
		</div>
		<span aria-hidden="true">→</span>
	</button>

	{#if loadState === 'error'}
		<p class="worlds-detail-error" role="alert">
			{errorMessage ?? t({ locale: $localeStore, key: 'worlds.error.generic' })}
		</p>
	{/if}

	<button class="worlds-detail-back-bottom" onclick={backToWorlds} type="button">
		{t({
			locale: $localeStore,
			key: 'worlds.detail.see_all',
			params: { total: rosterSize }
		})}
	</button>
</div>

<style lang="postcss">
	.worlds-detail {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0 1.25rem 6rem;
	}

	.worlds-detail-identity {
		display: grid;
		grid-template-columns: 64px 1fr;
		gap: 0.95rem;
		align-items: center;
		padding: 1rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.worlds-detail-glyph {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		font-size: var(--t-22, 1.5rem);
		font-weight: 700;
		color: var(--text-base);
		background: color-mix(in srgb, var(--laurel) 14%, var(--bg-surface));
		border-radius: var(--r-12);
	}

	.worlds-detail-identity-text {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.worlds-detail-identity-name {
		font-size: var(--t-20, 1.25rem);
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text-base);
	}

	.worlds-detail-identity-meta {
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
	}

	.worlds-detail-stats {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.85rem 1rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.worlds-detail-stats-title {
		margin: 0;
		color: var(--text-muted);
	}

	.worlds-detail-stats-hint {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
		line-height: 1.5;
	}

	.worlds-detail-stats-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}

	.worlds-detail-stats-cell {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.7rem 0.85rem;
		background: color-mix(in srgb, var(--bg-surface) 96%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.worlds-detail-stats-label {
		font-size: var(--t-10, 0.65rem);
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
	}

	.worlds-detail-stats-value {
		font-size: var(--t-22, 1.4rem);
		font-weight: 700;
		color: var(--text-base);
	}

	.worlds-detail-stats-sub {
		font-size: var(--t-10, 0.65rem);
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
	}

	.worlds-detail-stats-unranked {
		margin: 0.5rem 0 0;
		padding: 0.5rem 0.85rem;
		font-size: var(--t-10, 0.65rem);
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 96%, transparent);
		border-radius: var(--r-12);
	}

	.worlds-detail-cta {
		appearance: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.85rem;
		padding: 0.95rem 1rem;
		font: inherit;
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		cursor: pointer;
		transition:
			background 140ms ease,
			border-color 140ms ease;
	}

	.worlds-detail-cta:hover {
		background: color-mix(in srgb, var(--bg-surface) 60%, transparent);
		border-color: color-mix(in srgb, var(--laurel) 30%, var(--border-base));
	}

	.worlds-detail-cta-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		text-align: left;
	}

	.worlds-detail-cta-eyebrow {
		color: var(--laurel);
	}

	.worlds-detail-cta-label {
		font-size: var(--t-14);
		font-weight: 600;
	}

	.worlds-detail-error {
		margin: 0;
		padding: 0.85rem 1rem;
		font-size: var(--t-13);
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
		border-radius: var(--r-12);
	}

	.worlds-detail-back-bottom {
		appearance: none;
		padding: 0.65rem 1rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-muted);
		background: none;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		cursor: pointer;
	}

	.worlds-detail-back-bottom:hover {
		color: var(--text-base);
		border-color: color-mix(in srgb, var(--laurel) 30%, var(--border-base));
	}
</style>
