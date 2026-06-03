<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { EM_DASH } from '$lib/constants/app.constants';
	import type { MarketTag } from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { authPrincipal } from '$lib/derived/user.derived';
	import {
		findOwnStanding,
		getLeagueStandings,
		loadGlobalStandings,
		percentileBand
	} from '$lib/services/standings.services';
	import {
		leagueMembersStore,
		leaguesLoadedStore,
		myLeaguesStore,
		refreshMyLeagues
	} from '$lib/stores/leagues.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { globalStandingsStore } from '$lib/stores/standings.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		topCategory: { id: MarketTag; label: string; acc: number } | undefined;
		// When World-Cup mode is active the third tile shows WC accuracy
		// instead of the best evergreen category.
		worldCupActive?: boolean;
		wcAccuracy?: number;
	}

	let { topCategory, worldCupActive = false, wcAccuracy }: Props = $props();

	/**
	 * Rank context tiles — the viewer's global all-time rank and their rank
	 * within their primary league, both sourced from the clearing canister's
	 * `list_leaderboard` standings.
	 *
	 * The global tile reads the cached all-time global slice and finds the
	 * viewer's own entry; the league tile ranks the primary league's roster in
	 * isolation. Either tile falls back to an em-dash when the viewer has no
	 * settled position in that window (cold start) — never a fabricated number.
	 */

	// Hydrate the viewer's leagues so the league rank tile has a roster to
	// rank. The leagues store is shared + stale-while-revalidate, so this
	// no-ops once another surface has already loaded it this session.
	onMount(() => {
		if (!$leaguesLoadedStore) {
			void refreshMyLeagues().catch((err: unknown) => {
				console.error(err);
			});
		}
	});

	// The viewer's primary league: the most-recent membership the leagues
	// store holds (it sorts newest-join first). Drives the league tile and the
	// tap target.
	const primaryLeague = $derived($myLeaguesStore[0]?.league);

	// The viewer's all-time global standing, read from the cached slice.
	const globalStanding = $derived.by(() => {
		const result = $globalStandingsStore.get('all');

		if (result === undefined) {
			return;
		}

		return {
			entry: findOwnStanding({ result, owner: $authPrincipal }),
			total: result.total
		};
	});

	// The viewer's global percentile band ("Top X%"), restated from the same
	// authoritative rank / total — `undefined` (no band shown) until the slice
	// has resolved the viewer's own rank.
	const globalPercentile = $derived.by(() => {
		const entry = globalStanding?.entry;

		if (entry === undefined || globalStanding === undefined) {
			return;
		}

		return percentileBand({ rank: entry.rank, total: globalStanding.total });
	});

	// The viewer's rank within their primary league. Loaded on demand (it is a
	// per-league query, not the cached global slice).
	let leagueRank = $state<{ rank: number; total: number } | undefined>(undefined);

	// The viewer's percentile band within their primary league roster.
	const leaguePercentile = $derived.by(() =>
		leagueRank === undefined
			? undefined
			: percentileBand({ rank: leagueRank.rank, total: leagueRank.total })
	);

	// Load the global all-time slice once so the global tile can resolve the
	// viewer's rank. The store caches it, so a repeat mount short-circuits.
	$effect(() => {
		if ($globalStandingsStore.get('all') === undefined) {
			void loadGlobalStandings({ window: 'all' }).catch((err: unknown) => {
				console.error(err);
			});
		}
	});

	// Resolve the viewer's all-time rank within their primary league roster.
	$effect(() => {
		const league = primaryLeague;
		const owner = $authPrincipal;

		if (league === undefined || owner === undefined) {
			leagueRank = undefined;

			return;
		}

		const members = ($leagueMembersStore.get(league.id) ?? []).map((m) => m.member);

		if (members.length === 0) {
			leagueRank = undefined;

			return;
		}

		getLeagueStandings({ window: 'all', members })
			.then((result) => {
				const own = findOwnStanding({ result, owner });
				leagueRank = own === undefined ? undefined : { rank: own.rank, total: result.total };
			})
			.catch((err: unknown) => {
				console.error(err);
				leagueRank = undefined;
			});
	});

	// Tapping the league tile opens the primary league when known, else the
	// Arena leagues hub.
	const openLeague = () => {
		if (primaryLeague !== undefined) {
			void goto(`${resolve(AppPath.Arena)}/leagues/${primaryLeague.id}`);

			return;
		}

		void goto(resolve(AppPath.Arena));
	};
</script>

<div class="dash-section">
	<div class="dash-section-eyebrow">
		<span>{t({ locale: $localeStore, key: 'dash.rank.eyebrow' })}</span>
	</div>
	<div class="dash-rank-grid">
		<button
			class="dash-rank-tile dash-rank-tile-btn"
			onclick={() => goto(`${resolve(AppPath.Arena)}/leaderboard`)}
			type="button"
		>
			<span class="lbl">{t({ locale: $localeStore, key: 'dash.rank.global' })}</span>
			<span class="v num">
				{#if globalStanding?.entry !== undefined}#{globalStanding.entry.rank}{:else}{EM_DASH}{/if}
			</span>
			<span class="sub">
				{#if globalStanding?.entry !== undefined}
					{t({
						locale: $localeStore,
						key: 'dash.rank.of_total',
						params: { total: globalStanding.total }
					})}
				{:else}
					{t({ locale: $localeStore, key: 'dash.rank.global_sub' })}
				{/if}
			</span>
			{#if globalPercentile !== undefined}
				<span class="pctl num">
					{t({
						locale: $localeStore,
						key: 'dash.rank.percentile',
						params: { pct: globalPercentile }
					})}
				</span>
			{/if}
		</button>
		<button class="dash-rank-tile dash-rank-tile-btn" onclick={openLeague} type="button">
			<span class="lbl">{t({ locale: $localeStore, key: 'dash.rank.league' })}</span>
			<span class="v num">
				{#if leagueRank !== undefined}#{leagueRank.rank}{:else}{EM_DASH}{/if}
			</span>
			<span class="sub">
				{#if leagueRank !== undefined}
					{t({
						locale: $localeStore,
						key: 'dash.rank.of_total',
						params: { total: leagueRank.total }
					})}
				{:else}
					{t({ locale: $localeStore, key: 'dash.rank.league_sub' })}
				{/if}
			</span>
			{#if leaguePercentile !== undefined}
				<span class="pctl num">
					{t({
						locale: $localeStore,
						key: 'dash.rank.percentile',
						params: { pct: leaguePercentile }
					})}
				</span>
			{/if}
		</button>
		{#if worldCupActive}
			<div class="dash-rank-tile">
				<span class="lbl">{t({ locale: $localeStore, key: 'market.tag.wc' })}</span>
				<span class="v acc">
					{#if wcAccuracy !== undefined}{Math.round(wcAccuracy * 100)}%{:else}{EM_DASH}{/if}
				</span>
				<span class="sub">{t({ locale: $localeStore, key: 'dash.rank.wc_sub' })}</span>
			</div>
		{:else}
			<div class="dash-rank-tile">
				<span class="lbl">
					{#if topCategory}{topCategory.label}{:else}{t({
							locale: $localeStore,
							key: 'dash.rank.top_cat'
						})}{/if}
				</span>
				<span class="v acc">
					{#if topCategory}{Math.round(topCategory.acc * 100)}%{:else}{EM_DASH}{/if}
				</span>
				<span class="sub">{t({ locale: $localeStore, key: 'dash.rank.top_cat_sub' })}</span>
			</div>
		{/if}
	</div>
</div>
