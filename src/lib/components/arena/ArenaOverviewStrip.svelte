<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { EM_DASH } from '$lib/constants/app.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { lookupWorldsAffiliation } from '$lib/constants/worlds-affiliations.constants';
	import { leaderboard } from '$lib/derived/leaderboard.derived';
	import { listMyLeagues } from '$lib/services/leagues.services';
	import { listAffiliationStats } from '$lib/services/worlds.services';
	import { myAffiliationsStore, refreshMyAffiliations } from '$lib/stores/affiliations.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import {
		affiliationMonthlyAccuracy,
		affiliationRankComparator
	} from '$lib/utils/affiliation-stats.utils';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Arena overview strip — the user's standing across the three rings
	 * (Global / League / School), mirrored from the Beta L7 Arena hub.
	 * Each tile is a tappable button: filled tiles deep-link to the
	 * relevant detail surface, empty tiles are tap-to-fill prompts
	 * (League → Leagues tab, School → affiliation picker).
	 *
	 * Reuses the Dashboard's `.dash-rank-grid` / `.dash-rank-tile`
	 * classes for visual parity with `DashRankContext`, but the third
	 * tile is School (an affiliation), not a market category — hence a
	 * dedicated component rather than overloading `DashRankContext`.
	 *
	 * Ranks come from real data where the satellite exposes it:
	 *   - Global: viewer's index in the cached leaderboard.
	 *   - School: viewer's monthly rank among ranked universities.
	 * A league rank isn't surfaced by the satellite yet, so the League
	 * tile shows the league name (no fabricated `#rank`). Anywhere a
	 * rank is genuinely unavailable we render `EM_DASH`, matching the
	 * `DashRankContext` placeholder convention.
	 */

	interface Props {
		/**
		 * Switch the embedding Arena hub to its Leagues tab. Used by the
		 * empty-state League tile so "Join" lands the user on the in-hub
		 * Leagues surface instead of forking to a sibling route.
		 */
		onSelectLeaguesTab: () => void;
	}

	let { onSelectLeaguesTab }: Props = $props();

	let leagueName = $state<string | undefined>(undefined);
	let hasLeague = $state(false);
	let schoolRank = $state<number | undefined>(undefined);

	const userPrincipal = $derived($userStore.user?.owner);

	// School tile reads the caller's university from the shared
	// affiliations cache (stale-while-revalidate) so revisiting the hub
	// doesn't blank the tile while a fetch is in flight.
	const schoolId = $derived($myAffiliationsStore.university?.affiliationIdentifier);

	// Global rank — viewer's 1-based position in the cached leaderboard,
	// or `undefined` when they aren't on it yet (renders EM_DASH).
	const globalRank = $derived.by<number | undefined>(() => {
		const principal = userPrincipal;

		if (principal === undefined) {
			return;
		}

		const idx = $leaderboard.findIndex((entry) => entry.owner === principal);

		return idx === -1 ? undefined : idx + 1;
	});

	onMount(() => {
		// Affiliations come from the shared cache (refreshed in the
		// background); the league leg loads independently so a failure on
		// either leaves its tile in the empty (tap-to-fill) state rather
		// than blocking the strip.
		void refreshMyAffiliations();
		void hydrateLeague();
	});

	const hydrateLeague = async (): Promise<void> => {
		try {
			const [first] = await listMyLeagues();
			hasLeague = first !== undefined;
			leagueName = first?.league.name;
		} catch {
			// Leave the League tile in its empty state.
		}
	};

	// Re-rank the school tile whenever the cached university changes
	// (cold load, picker pick, or background refresh).
	$effect(() => {
		const id = schoolId;

		if (id === undefined) {
			schoolRank = undefined;

			return;
		}

		void hydrateSchoolRank(id);
	});

	const hydrateSchoolRank = async (id: string): Promise<void> => {
		try {
			// `listAffiliationStats` is not guaranteed to come back
			// month-sorted, so rank it here by monthly accuracy with the
			// same comparator WorldsPage uses for its month scope (accuracy
			// desc, then more calls, then stable id). The viewer's 1-based
			// index in that order is their month rank; not-present -> EM_DASH.
			const stats = await listAffiliationStats({ kind: 'university' });
			const ranked = [...stats].sort(
				affiliationRankComparator({
					accuracyOf: affiliationMonthlyAccuracy,
					callsOf: (row) => row.totalCalls
				})
			);
			const idx = ranked.findIndex((row) => row.affiliationIdentifier === id);
			schoolRank = idx === -1 ? undefined : idx + 1;
		} catch {
			schoolRank = undefined;
		}
	};

	const schoolName = $derived.by<string | undefined>(() => {
		const id = schoolId;

		if (id === undefined) {
			return;
		}

		return lookupWorldsAffiliation({ kind: 'university', id })?.name ?? id;
	});

	const goGlobal = () => {
		void goto(resolve(`${AppPath.Arena}/leaderboard`));
	};

	const goLeague = () => {
		// No per-league id list yet on this strip (the satellite returns
		// the membership but the hub routes by tab); send filled-state
		// taps to the Leagues tab where the user's league is surfaced.
		onSelectLeaguesTab();
	};

	const goSchool = () => {
		const id = schoolId;

		if (id !== undefined) {
			void goto(`${resolve(AppPath.Arena)}/worlds/school/${id}`);

			return;
		}

		// Unaffiliated → the schools surface, which renders the
		// affiliation picker prompt.
		void goto(`${resolve(AppPath.Arena)}/worlds/schools`);
	};
</script>

<div class="dash-rank-grid arena-overview-strip">
	<button
		class="dash-rank-tile dash-rank-tile-btn"
		aria-label={t({ locale: $localeStore, key: 'arena.overview.global_aria' })}
		onclick={goGlobal}
		type="button"
	>
		<span class="lbl">{t({ locale: $localeStore, key: 'dash.rank.global' })}</span>
		<span class="v"
			>{#if globalRank !== undefined}#{globalRank}{:else}{EM_DASH}{/if}</span
		>
		<span class="sub">{t({ locale: $localeStore, key: 'arena.overview.global_sub' })}</span>
	</button>

	<button
		class="dash-rank-tile dash-rank-tile-btn"
		aria-label={hasLeague
			? t({ locale: $localeStore, key: 'arena.overview.league_aria_view' })
			: t({ locale: $localeStore, key: 'arena.overview.league_aria_join' })}
		onclick={goLeague}
		type="button"
	>
		<span class="lbl">{t({ locale: $localeStore, key: 'dash.rank.league' })}</span>
		<span class="v">
			{#if hasLeague}{EM_DASH}{:else}{t({
					locale: $localeStore,
					key: 'arena.overview.league_join'
				})}{/if}
		</span>
		<span class="sub">
			{#if hasLeague}{leagueName ??
					t({ locale: $localeStore, key: 'dash.rank.league_sub' })}{:else}{t({
					locale: $localeStore,
					key: 'arena.overview.league_tap'
				})}{/if}
		</span>
	</button>

	<button
		class="dash-rank-tile dash-rank-tile-btn"
		aria-label={schoolId !== undefined
			? t({ locale: $localeStore, key: 'arena.overview.school_aria_view' })
			: t({ locale: $localeStore, key: 'arena.overview.school_aria_pick' })}
		onclick={goSchool}
		type="button"
	>
		<span class="lbl">{t({ locale: $localeStore, key: 'arena.overview.school' })}</span>
		<span class="v">
			{#if schoolId !== undefined}{#if schoolRank !== undefined}#{schoolRank}{:else}{EM_DASH}{/if}{:else}{t(
					{ locale: $localeStore, key: 'arena.overview.school_pick' }
				)}{/if}
		</span>
		<span class="sub">
			{#if schoolName !== undefined}{schoolName}{:else}{t({
					locale: $localeStore,
					key: 'arena.overview.school_tap'
				})}{/if}
		</span>
	</button>
</div>

<style lang="postcss">
	/* The strip sits between the appbar and the tab strip; a small
	   bottom gap separates it from the tabs without doubling the hub's
	   own row gap. The grid + tile visuals come from the shared
	   `.dash-rank-*` classes in app.css. */
	.arena-overview-strip {
		margin-bottom: 0.5rem;
	}

	/* Tappable tiles need pointer affordance + left-aligned text
	   (the shared `.dash-rank-tile` centers its block content by
	   default on buttons in some browsers). */
	.dash-rank-tile-btn {
		text-align: left;
		cursor: pointer;
	}

	.dash-rank-tile-btn:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--color-primary) 55%, transparent);
		outline-offset: 2px;
	}
</style>
