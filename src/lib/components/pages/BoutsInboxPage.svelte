<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import CreateBoutModal from '$lib/components/leagues/CreateBoutModal.svelte';
	import ResolveBoutModal from '$lib/components/leagues/ResolveBoutModal.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import {
		lookupWorldsAffiliation,
		WORLDS_COUNTRIES,
		WORLDS_UNIVERSITIES
	} from '$lib/constants/worlds-affiliations.constants';
	import { daysToFinal } from '$lib/derived/featured-event.derived';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import {
		acceptBout,
		kickoffBout,
		listMyBouts,
		listMyLeagues,
		retractBout,
		type LeagueWithRole
	} from '$lib/services/leagues.services';
	import { getCurrentTournament } from '$lib/services/tournament.services';
	import { listAffiliationStats, listMyAffiliations } from '$lib/services/worlds.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { AffiliationDoc } from '$lib/types/affiliation';
	import type { AffiliationStatsDoc } from '$lib/types/affiliation-stats';
	import type { BoutDoc } from '$lib/types/bout';
	import {
		TOURNAMENT_ROUNDS,
		type TournamentDoc,
		type TournamentMatchDoc,
		type TournamentRound
	} from '$lib/types/tournament';
	import { formatDate } from '$lib/utils/format.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { goBack } from '$lib/utils/nav.utils';

	/**
	 * Bouts inbox — the prototype's `BoutsScreen` (screens.jsx:3088).
	 *
	 * The page is composed of four surface-grouped sections (the
	 * prototype groups by **surface**, never by bout state):
	 *
	 *  1. Optional "What's a bout?" intro card — dismissible, persists
	 *     via `localStorage['vici.bouts-intro-seen']` to match the
	 *     prototype. The locked design calls for cross-device
	 *     `preferences` storage; that's deferred until the satellite
	 *     `preferences` schema can be migrated without a Candid + Rust
	 *     binding regen (see audit doc — Bouts inbox).
	 *
	 *  2. Worlds Universities — featured WC podium card (top 3 by
	 *     lifetime accuracy) + monthly compact card linking to the
	 *     Worlds detail surface.
	 *
	 *  3. Worlds Countries — same shape as Universities, sourced off
	 *     `listAffiliationStats({ kind: 'country' })`.
	 *
	 *  4. Monthly Tournament curated card — rendered only when the
	 *     current tournament has unresolved rounds in flight.
	 *
	 *  5. Your league bouts — the cross-league inbox, with a
	 *     `Challenge` pill on the right of the section eyebrow (the
	 *     prototype moved the create-bout CTA out of the page header
	 *     into the league-bouts section header).
	 *
	 * Side chips use the league's `accentColor` directly (13% opacity
	 * background, 30% border) so each league's emblem tone reads on the
	 * card surface rather than the generic laurel.
	 */

	interface Props {
		// When true, hide the page's own appbar — the container is
		// expected to render one (e.g. the tabbed Social parent).
		embedded?: boolean;
	}

	const { embedded = false }: Props = $props();

	// ─── Bouts inbox state ──────────────────────────────────────────
	let bouts: BoutDoc[] = $state([]);
	let memberships: LeagueWithRole[] = $state([]);
	let selfPrincipal: string | undefined = $state();
	let loadState: 'loading' | 'ready' | 'error' = $state('loading');
	let errorMessage: string | null = $state(null);

	// ─── Worlds podium state ────────────────────────────────────────
	let myUni = $state<AffiliationDoc | undefined>();
	let myCountry = $state<AffiliationDoc | undefined>();
	let uniStats = $state<AffiliationStatsDoc[]>([]);
	let countryStats = $state<AffiliationStatsDoc[]>([]);

	// ─── Tournament state ───────────────────────────────────────────
	let tournament = $state<TournamentDoc | null>(null);
	let matches = $state<TournamentMatchDoc[]>([]);

	// ─── Intro card dismissal ───────────────────────────────────────
	// Matches the prototype's `localStorage['vici.bouts-intro-seen']`
	// flag. Future migration to cross-device preferences is tracked in
	// the audit doc (Bouts inbox surface) — adding a new field to the
	// satellite preferences schema requires a Candid + Rust binding
	// regen scoped outside this parity pass.
	const BOUTS_INTRO_KEY = 'vici.bouts-intro-seen';
	let boutsIntroSeen = $state(false);

	const load = async () => {
		try {
			const [boutList, mineList, identity, affils, schools, countries, tour] = await Promise.all([
				listMyBouts(),
				listMyLeagues(),
				safeGetIdentityOnce(),
				listMyAffiliations(),
				listAffiliationStats({ kind: 'university' }),
				listAffiliationStats({ kind: 'country' }),
				getCurrentTournament()
			]);
			bouts = boutList;
			memberships = mineList;
			selfPrincipal = identity.getPrincipal().toText();
			myUni = affils.university;
			myCountry = affils.country;
			uniStats = schools;
			countryStats = countries;
			({ tournament, matches } = tour);
			loadState = 'ready';
		} catch (err) {
			console.error('BoutsInboxPage: load failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
			loadState = 'error';
		}
	};

	onMount(() => {
		if (browser) {
			try {
				boutsIntroSeen = localStorage.getItem(BOUTS_INTRO_KEY) === '1';
			} catch {
				// Storage unavailable — keep the intro visible.
			}
		}

		void load();
	});

	const dismissIntro = () => {
		boutsIntroSeen = true;

		if (browser) {
			try {
				localStorage.setItem(BOUTS_INTRO_KEY, '1');
			} catch {
				// Storage unavailable — dismissal won't survive a reload.
			}
		}
	};

	// ─── Membership / sides ─────────────────────────────────────────
	const membershipByLeagueId = $derived.by(() => {
		const map = new SvelteMap<string, LeagueWithRole>();

		for (const m of memberships) {
			map.set(m.league.id, m);
		}

		return map;
	});

	const myLeagueIds = $derived(new SvelteSet(memberships.map((m) => m.league.id)));

	const sideLabel = (sideId: string): string => {
		const mine = membershipByLeagueId.get(sideId);

		return mine?.league.name ?? sideId;
	};

	const sideAccent = (sideId: string): string =>
		membershipByLeagueId.get(sideId)?.league.accentColor ?? 'var(--laurel)';

	const boutStateLabelKey = (state: BoutDoc['state']): MessageKey => {
		switch (state) {
			case 'proposed':
				return 'leagues.bout.state.proposed';
			case 'accepted':
				return 'leagues.bout.state.accepted';
			case 'in_flight':
				return 'leagues.bout.state.in_flight';
			case 'resolved':
				return 'leagues.bout.state.resolved';
		}
	};

	const ownedSide = (bout: BoutDoc): string | undefined => {
		const a = membershipByLeagueId.get(bout.sideA);

		if (a?.role === 'owner') {
			return bout.sideA;
		}

		const b = membershipByLeagueId.get(bout.sideB);

		return b?.role === 'owner' ? bout.sideB : undefined;
	};

	const canAcceptBout = (bout: BoutDoc): boolean => {
		const owned = ownedSide(bout);

		return owned !== undefined && bout.state === 'proposed' && bout.sideB === owned;
	};

	const canKickoffBout = (bout: BoutDoc): boolean =>
		ownedSide(bout) !== undefined && bout.state === 'accepted' && Date.now() >= bout.kickoffMs;

	const canResolveBout = (bout: BoutDoc): boolean =>
		ownedSide(bout) !== undefined && bout.state === 'in_flight' && Date.now() >= bout.settleMs;

	const canRetractBout = (bout: BoutDoc): boolean =>
		bout.state === 'proposed' && selfPrincipal !== undefined && bout.proposer === selfPrincipal;

	let actingBoutId = $state<string | null>(null);
	let resolveBoutTarget = $state<BoutDoc | null>(null);
	let resolveBoutOurSide = $state<string | null>(null);

	const handleAcceptBout = async (bout: BoutDoc) => {
		if (actingBoutId !== null) {
			return;
		}

		actingBoutId = bout.id;

		try {
			await acceptBout({ bout });
			await load();
		} catch (err) {
			console.error('BoutsInboxPage: acceptBout failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBoutId = null;
		}
	};

	const handleKickoffBout = async (bout: BoutDoc) => {
		if (actingBoutId !== null) {
			return;
		}

		actingBoutId = bout.id;

		try {
			await kickoffBout({ bout });
			await load();
		} catch (err) {
			console.error('BoutsInboxPage: kickoffBout failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBoutId = null;
		}
	};

	const openResolve = (bout: BoutDoc) => {
		const owned = ownedSide(bout);

		if (owned === undefined) {
			return;
		}

		resolveBoutTarget = bout;
		resolveBoutOurSide = owned;
	};

	const handleRetractBout = async (bout: BoutDoc) => {
		if (actingBoutId !== null) {
			return;
		}

		actingBoutId = bout.id;

		try {
			await retractBout({ bout });
			await load();
		} catch (err) {
			console.error('BoutsInboxPage: retractBout failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBoutId = null;
		}
	};

	const handleResolveDone = () => {
		resolveBoutTarget = null;
		resolveBoutOurSide = null;
		void load();
	};

	const goToLeague = (leagueId: string) => {
		if (!myLeagueIds.has(leagueId)) {
			return;
		}

		void goto(`${resolve(AppPath.Social)}/leagues/${leagueId}`);
	};

	const goToBoutDetail = (bout: BoutDoc) => {
		void goto(`${resolve(AppPath.Social)}/bouts/${bout.id}`);
	};

	// ─── Worlds podium helpers ──────────────────────────────────────
	const accLifetime = (s: AffiliationStatsDoc): number =>
		s.totalCalls > 0 ? s.wins / s.totalCalls : 0;

	const accMonth = (s: AffiliationStatsDoc): number =>
		s.monthTotalCalls > 0 ? s.monthWins / s.monthTotalCalls : 0;

	/**
	 * Top-3 by WC (lifetime) accuracy for a roster. The featured
	 * podium always frames the World Cup bout — same shape as
	 * WorldsPage's `wcTop3`.
	 */
	const wcTop3 = ({ stats }: { stats: AffiliationStatsDoc[] }): AffiliationStatsDoc[] => {
		const list = [...stats];

		list.sort((a, b) => {
			const da = accLifetime(a);
			const db = accLifetime(b);

			if (da !== db) {
				return db - da;
			}

			if (a.totalCalls !== b.totalCalls) {
				return b.totalCalls - a.totalCalls;
			}

			return a.affiliationId.localeCompare(b.affiliationId);
		});

		return list.slice(0, 3);
	};

	const uniWcTop3 = $derived(wcTop3({ stats: uniStats }));
	const countryWcTop3 = $derived(wcTop3({ stats: countryStats }));

	/**
	 * Caller's rank in the lifetime-accuracy ranking for a roster.
	 * Returns `0` when the user has no affiliation or the affiliation
	 * isn't in the roster yet (no stats doc).
	 */
	const rankIn = ({
		stats,
		affiliationId
	}: {
		stats: AffiliationStatsDoc[];
		affiliationId: string | undefined;
	}): number => {
		if (affiliationId === undefined) {
			return 0;
		}

		const sorted = [...stats].sort((a, b) => {
			const da = accLifetime(a);
			const db = accLifetime(b);

			if (da !== db) {
				return db - da;
			}

			if (a.totalCalls !== b.totalCalls) {
				return b.totalCalls - a.totalCalls;
			}

			return a.affiliationId.localeCompare(b.affiliationId);
		});

		const idx = sorted.findIndex((s) => s.affiliationId === affiliationId);

		return idx === -1 ? 0 : idx + 1;
	};

	const myUniStats = $derived.by(() => {
		const uni = myUni;

		return uni ? uniStats.find((s) => s.affiliationId === uni.affiliationId) : undefined;
	});

	const myUniRank = $derived(rankIn({ stats: uniStats, affiliationId: myUni?.affiliationId }));

	const myCountryStats = $derived.by(() => {
		const country = myCountry;

		return country
			? countryStats.find((s) => s.affiliationId === country.affiliationId)
			: undefined;
	});

	const myCountryRank = $derived(
		rankIn({ stats: countryStats, affiliationId: myCountry?.affiliationId })
	);

	const universityCount = WORLDS_UNIVERSITIES.length;
	const countryCount = WORLDS_COUNTRIES.length;

	const eventDaysLeft = $derived($daysToFinal);

	const fmtPct1 = (acc: number): string => `${(acc * 100).toFixed(1)}%`;

	const uniOption = (id: string) => lookupWorldsAffiliation({ kind: 'university', id });
	const countryOption = (id: string) => lookupWorldsAffiliation({ kind: 'country', id });

	const goWorldsUniversitiesWc = () => {
		void goto(`${resolve(AppPath.Social)}/worlds/schools`);
	};

	const goWorldsUniversitiesMonth = () => {
		void goto(`${resolve(AppPath.Social)}/worlds/schools?scope=month`);
	};

	const goWorldsCountriesWc = () => {
		void goto(`${resolve(AppPath.Social)}/worlds/countries`);
	};

	const goWorldsCountriesMonth = () => {
		void goto(`${resolve(AppPath.Social)}/worlds/countries?scope=month`);
	};

	const goTournament = () => {
		void goto(`${resolve(AppPath.Social)}/tournament`);
	};

	// ─── Tournament card derivations ────────────────────────────────
	/**
	 * Surface the tournament card only when the current bracket has at
	 * least one round in flight (a match whose window hasn't closed
	 * and that has unresolved matches). Mirrors the prototype's
	 * `T.status !== 'completed'` gate, but tied to live data rather
	 * than mocked status.
	 */
	const tournamentLiveRound = $derived.by((): TournamentRound | null => {
		if (tournament === null) {
			return null;
		}

		for (const round of TOURNAMENT_ROUNDS) {
			const ms = matches.filter((m) => m.round === round);

			if (ms.length > 0) {
				const allDone = ms.every((m) => m.winnerLeagueId !== null);
				const someOpen = ms.some((m) => m.endMs > Date.now());

				if (!allDone && someOpen) {
					return round;
				}
			}
		}

		return null;
	});

	const tournamentDaysLeft = $derived.by((): number | null => {
		if (tournamentLiveRound === null) {
			return null;
		}

		const ms = matches.filter((m) => m.round === tournamentLiveRound);

		if (ms.length === 0) {
			return null;
		}

		// Use the earliest open match's window — that's when the
		// current round closes.
		const earliestEnd = Math.min(...ms.filter((m) => m.endMs > Date.now()).map((m) => m.endMs));
		const delta = earliestEnd - Date.now();

		return delta <= 0 ? 0 : Math.ceil(delta / 86_400_000);
	});

	const tournamentRoundKey = (round: TournamentRound): MessageKey => {
		switch (round) {
			case 'r1':
				return 'bouts.tournament.round.r1';
			case 'quarter':
				return 'bouts.tournament.round.quarter';
			case 'semifinal':
				return 'bouts.tournament.round.semifinal';
			case 'final':
				return 'bouts.tournament.round.final';
		}
	};

	const tournamentRemainingLeagues = $derived(
		matches.filter((m) => m.round === tournamentLiveRound && m.winnerLeagueId === null).length * 2
	);

	const myLeagueIdsArr = $derived(memberships.map((m) => m.league.id));

	const myLeagueInTournament = $derived.by((): { rank: number } | null => {
		if (tournament === null) {
			return null;
		}

		const myInSeeded = tournament.seededLeagueIds.findIndex((id) => myLeagueIdsArr.includes(id));

		if (myInSeeded === -1) {
			return null;
		}

		// Still in the bracket? Check if our league appears as winner
		// in any *resolved* match, or has an unresolved slot ahead.
		const myLeagueId = tournament.seededLeagueIds[myInSeeded];
		const isStillIn = matches.some(
			(m) =>
				(m.fromLeagueId === myLeagueId || m.toLeagueId === myLeagueId) && m.winnerLeagueId === null
		);

		if (!isStillIn) {
			return null;
		}

		return { rank: myInSeeded + 1 };
	});

	// ─── League bouts list ──────────────────────────────────────────
	const BOUT_SORT_ORDER: readonly BoutDoc['state'][] = [
		'in_flight',
		'accepted',
		'proposed',
		'resolved'
	] as const;

	const sortedLeagueBouts = $derived.by(() => {
		const order = new Map(BOUT_SORT_ORDER.map((s, i) => [s, i]));

		return [...bouts].sort((a, b) => {
			const oa = order.get(a.state) ?? 99;
			const ob = order.get(b.state) ?? 99;

			if (oa !== ob) {
				return oa - ob;
			}

			return b.kickoffMs - a.kickoffMs;
		});
	});

	const LEAGUE_BOUT_PREVIEW = 4;
	let showAllLeagueBouts = $state(false);

	const visibleLeagueBouts = $derived(
		showAllLeagueBouts ? sortedLeagueBouts : sortedLeagueBouts.slice(0, LEAGUE_BOUT_PREVIEW)
	);

	let createOpen = $state(false);
</script>

<div class="bouts-inbox">
	{#if !embedded}
		<MobileAppBar
			align="left"
			back={{
				label: t({ locale: $localeStore, key: 'leagues.bouts_inbox.back' }),
				onBack: () => goBack(resolve(AppPath.Social))
			}}
			title={t({ locale: $localeStore, key: 'leagues.bouts_inbox.title' })}
		/>
	{/if}

	{#if !boutsIntroSeen}
		<aside class="bouts-intro">
			<span class="serif-italic bouts-intro-lede">
				{t({ locale: $localeStore, key: 'bouts.intro.lede' })}
			</span>
			<p class="bouts-intro-body">
				{t({ locale: $localeStore, key: 'bouts.intro.body' })}
			</p>
			<button
				class="bouts-intro-dismiss"
				aria-label={t({ locale: $localeStore, key: 'bouts.intro.dismiss' })}
				onclick={dismissIntro}
				type="button"
			>
				×
			</button>
		</aside>
	{/if}

	{#if loadState === 'loading'}
		<p class="bouts-inbox-status" aria-busy="true">
			{t({ locale: $localeStore, key: 'leagues.bouts_inbox.loading' })}
		</p>
	{:else if loadState === 'error'}
		<p class="bouts-inbox-error" role="alert">
			{errorMessage ?? t({ locale: $localeStore, key: 'leagues.error.generic' })}
		</p>
	{:else}
		<!-- ─── Worlds Universities ─────────────────────────────── -->
		<section class="bouts-section" aria-label="Worlds Universities">
			<header class="bouts-section-head">
				<span class="bouts-eyebrow allcaps">
					{t({ locale: $localeStore, key: 'bouts.section.worlds_universities' })}
				</span>
				{#if myUni}
					{@const opt = uniOption(myUni.affiliationId)}
					<span class="bouts-section-head-meta num allcaps">
						{t({
							locale: $localeStore,
							key: 'bouts.your_school',
							params: { name: opt?.name ?? myUni.affiliationId }
						})}
					</span>
				{/if}
			</header>

			<button class="bouts-card is-featured" onclick={goWorldsUniversitiesWc} type="button">
				<div class="bouts-card-head">
					<div class="bouts-card-tags">
						<span class="bouts-tag is-wc">
							{t({ locale: $localeStore, key: 'worlds.event.tag_wc' })}
						</span>
						<span class="bouts-tag is-live">
							{t({ locale: $localeStore, key: 'worlds.event.tag_live' })}
						</span>
					</div>
					{#if eventDaysLeft !== null}
						<span class="bouts-card-timer num">
							{t({
								locale: $localeStore,
								key: 'bouts.card.days_left',
								params: { days: eventDaysLeft }
							})}
						</span>
					{/if}
				</div>
				<h3 class="bouts-card-title">
					{t({ locale: $localeStore, key: 'bouts.uni.wc_title_lede' })}
					<span class="serif-italic">
						{t({ locale: $localeStore, key: 'bouts.uni.wc_title_emph' })}
					</span>
					{t({ locale: $localeStore, key: 'bouts.uni.wc_title_tail' })}
				</h3>
				<p class="bouts-card-meta">
					{t({
						locale: $localeStore,
						key: 'bouts.uni.wc_sub',
						params: { schools: universityCount }
					})}
				</p>

				{#if uniWcTop3.length > 0}
					<div class="bouts-podium">
						{#if uniWcTop3[1]}
							{@const opt = uniOption(uniWcTop3[1].affiliationId)}
							<div class="bouts-pod-tile is-silver">
								<div class="num bouts-pod-place">02</div>
								<div class="bouts-pod-name">
									{opt?.name ?? uniWcTop3[1].affiliationId}
								</div>
								<div class="num bouts-pod-pct">{fmtPct1(accLifetime(uniWcTop3[1]))}</div>
							</div>
						{/if}
						{#if uniWcTop3[0]}
							{@const opt = uniOption(uniWcTop3[0].affiliationId)}
							<div class="bouts-pod-tile is-gold">
								<div class="num bouts-pod-place">01</div>
								<div class="bouts-pod-name">
									{opt?.name ?? uniWcTop3[0].affiliationId}
								</div>
								<div class="num bouts-pod-pct">{fmtPct1(accLifetime(uniWcTop3[0]))}</div>
							</div>
						{/if}
						{#if uniWcTop3[2]}
							{@const opt = uniOption(uniWcTop3[2].affiliationId)}
							<div class="bouts-pod-tile is-bronze">
								<div class="num bouts-pod-place">03</div>
								<div class="bouts-pod-name">
									{opt?.name ?? uniWcTop3[2].affiliationId}
								</div>
								<div class="num bouts-pod-pct">{fmtPct1(accLifetime(uniWcTop3[2]))}</div>
							</div>
						{/if}
					</div>
				{/if}

				{#if myUni && myUniStats}
					{@const opt = uniOption(myUni.affiliationId)}
					<div class="bouts-your-row">
						<span class="bouts-your-em" aria-hidden="true">
							{(opt?.name ?? myUni.affiliationId).charAt(0)}
						</span>
						<span class="bouts-your-text">
							<b>{opt?.name ?? myUni.affiliationId}</b>
							·
							{t({
								locale: $localeStore,
								key: 'bouts.your_rank',
								params: { rank: myUniRank, total: universityCount }
							})}
						</span>
						<span class="num bouts-your-pct">{fmtPct1(accLifetime(myUniStats))}</span>
					</div>
				{/if}
			</button>

			<button class="bouts-card is-compact" onclick={goWorldsUniversitiesMonth} type="button">
				<div class="bouts-card-head">
					<span class="bouts-tag is-monthly">
						{t({ locale: $localeStore, key: 'bouts.tag.monthly_all_calls' })}
					</span>
				</div>
				{#if myUni && myUniStats}
					{@const opt = uniOption(myUni.affiliationId)}
					<div class="bouts-your-row is-tight">
						<span class="bouts-your-em" aria-hidden="true">
							{(opt?.name ?? myUni.affiliationId).charAt(0)}
						</span>
						<span class="bouts-your-text">
							<b>{opt?.name ?? myUni.affiliationId}</b>
							·
							{t({
								locale: $localeStore,
								key: 'bouts.your_rank',
								params: { rank: myUniRank, total: universityCount }
							})}
						</span>
						<span class="num bouts-your-pct">{fmtPct1(accMonth(myUniStats))}</span>
					</div>
				{:else}
					<p class="bouts-card-meta">
						{t({
							locale: $localeStore,
							key: 'bouts.uni.month_pick',
							params: { count: universityCount }
						})}
					</p>
				{/if}
				<span class="bouts-see-all allcaps">
					{t({ locale: $localeStore, key: 'bouts.see_full_standings' })}
				</span>
			</button>
		</section>

		<!-- ─── Worlds Countries ────────────────────────────────── -->
		<section class="bouts-section" aria-label="Worlds Countries">
			<header class="bouts-section-head">
				<span class="bouts-eyebrow allcaps">
					{t({ locale: $localeStore, key: 'bouts.section.worlds_countries' })}
				</span>
				{#if myCountry}
					{@const opt = countryOption(myCountry.affiliationId)}
					<span class="bouts-section-head-meta num allcaps">
						{opt?.glyph ?? ''}
						{(opt?.name ?? myCountry.affiliationId).toUpperCase()}
					</span>
				{/if}
			</header>

			<button class="bouts-card is-featured" onclick={goWorldsCountriesWc} type="button">
				<div class="bouts-card-head">
					<div class="bouts-card-tags">
						<span class="bouts-tag is-wc">
							{t({ locale: $localeStore, key: 'worlds.event.tag_wc' })}
						</span>
						<span class="bouts-tag is-live">
							{t({ locale: $localeStore, key: 'worlds.event.tag_live' })}
						</span>
					</div>
					{#if eventDaysLeft !== null}
						<span class="bouts-card-timer num">
							{t({
								locale: $localeStore,
								key: 'bouts.card.days_left',
								params: { days: eventDaysLeft }
							})}
						</span>
					{/if}
				</div>
				<h3 class="bouts-card-title">
					{t({ locale: $localeStore, key: 'bouts.country.wc_title_lede' })}
					<span class="serif-italic">
						{t({ locale: $localeStore, key: 'bouts.country.wc_title_emph' })}
					</span>
					{t({ locale: $localeStore, key: 'bouts.country.wc_title_tail' })}
				</h3>
				<p class="bouts-card-meta">
					{t({
						locale: $localeStore,
						key: 'bouts.country.wc_sub',
						params: { nations: countryCount }
					})}
				</p>

				{#if countryWcTop3.length > 0}
					<div class="bouts-podium">
						{#if countryWcTop3[1]}
							{@const opt = countryOption(countryWcTop3[1].affiliationId)}
							<div class="bouts-pod-tile is-silver">
								<div class="num bouts-pod-place">02</div>
								<div class="bouts-pod-name">
									{opt?.glyph ?? ''}
									{opt?.name ?? countryWcTop3[1].affiliationId}
								</div>
								<div class="num bouts-pod-pct">{fmtPct1(accLifetime(countryWcTop3[1]))}</div>
							</div>
						{/if}
						{#if countryWcTop3[0]}
							{@const opt = countryOption(countryWcTop3[0].affiliationId)}
							<div class="bouts-pod-tile is-gold">
								<div class="num bouts-pod-place">01</div>
								<div class="bouts-pod-name">
									{opt?.glyph ?? ''}
									{opt?.name ?? countryWcTop3[0].affiliationId}
								</div>
								<div class="num bouts-pod-pct">{fmtPct1(accLifetime(countryWcTop3[0]))}</div>
							</div>
						{/if}
						{#if countryWcTop3[2]}
							{@const opt = countryOption(countryWcTop3[2].affiliationId)}
							<div class="bouts-pod-tile is-bronze">
								<div class="num bouts-pod-place">03</div>
								<div class="bouts-pod-name">
									{opt?.glyph ?? ''}
									{opt?.name ?? countryWcTop3[2].affiliationId}
								</div>
								<div class="num bouts-pod-pct">{fmtPct1(accLifetime(countryWcTop3[2]))}</div>
							</div>
						{/if}
					</div>
				{/if}

				{#if myCountry && myCountryStats}
					{@const opt = countryOption(myCountry.affiliationId)}
					<div class="bouts-your-row">
						<span class="bouts-your-em" aria-hidden="true">{opt?.glyph ?? ''}</span>
						<span class="bouts-your-text">
							<b>{opt?.name ?? myCountry.affiliationId}</b>
							·
							{t({
								locale: $localeStore,
								key: 'bouts.your_rank',
								params: { rank: myCountryRank, total: countryCount }
							})}
						</span>
						<span class="num bouts-your-pct">{fmtPct1(accLifetime(myCountryStats))}</span>
					</div>
				{/if}
			</button>

			<button class="bouts-card is-compact" onclick={goWorldsCountriesMonth} type="button">
				<div class="bouts-card-head">
					<span class="bouts-tag is-monthly">
						{t({ locale: $localeStore, key: 'bouts.tag.monthly_all_calls' })}
					</span>
				</div>
				{#if myCountry && myCountryStats}
					{@const opt = countryOption(myCountry.affiliationId)}
					<div class="bouts-your-row is-tight">
						<span class="bouts-your-em" aria-hidden="true">{opt?.glyph ?? ''}</span>
						<span class="bouts-your-text">
							<b>{opt?.name ?? myCountry.affiliationId}</b>
							·
							{t({
								locale: $localeStore,
								key: 'bouts.your_rank',
								params: { rank: myCountryRank, total: countryCount }
							})}
						</span>
						<span class="num bouts-your-pct">{fmtPct1(accMonth(myCountryStats))}</span>
					</div>
				{:else}
					<p class="bouts-card-meta">
						{t({
							locale: $localeStore,
							key: 'bouts.country.month_pick',
							params: { count: countryCount }
						})}
					</p>
				{/if}
				<span class="bouts-see-all allcaps">
					{t({ locale: $localeStore, key: 'bouts.see_full_standings' })}
				</span>
			</button>
		</section>

		<!-- ─── Monthly Tournament (curated, when active) ─────── -->
		{#if tournament !== null && tournamentLiveRound !== null}
			<section class="bouts-section" aria-label="Tournament">
				<header class="bouts-section-head">
					<span class="bouts-eyebrow allcaps">
						{t({ locale: $localeStore, key: 'bouts.section.tournament' })}
					</span>
					<span class="bouts-section-head-meta num allcaps">
						{t({ locale: $localeStore, key: 'bouts.tournament.meta' })}
					</span>
				</header>

				<button class="bouts-card is-featured is-tournament" onclick={goTournament} type="button">
					<div class="bouts-card-head">
						<div class="bouts-card-tags">
							<span class="bouts-tag is-tournament-round">
								{t({ locale: $localeStore, key: tournamentRoundKey(tournamentLiveRound) })}
							</span>
							<span class="bouts-tag is-live">
								{t({ locale: $localeStore, key: 'worlds.event.tag_live' })}
							</span>
						</div>
						{#if tournamentDaysLeft !== null}
							<span class="bouts-card-timer num">
								{t({
									locale: $localeStore,
									key: 'bouts.card.days_left',
									params: { days: tournamentDaysLeft }
								})}
							</span>
						{/if}
					</div>
					<h3 class="bouts-card-title">
						{t({ locale: $localeStore, key: 'bouts.tournament.title_lede' })}
						<span class="serif-italic">
							{t({
								locale: $localeStore,
								key: 'bouts.tournament.title_emph',
								params: { size: tournament.bracketSize }
							})}
						</span>
						{t({ locale: $localeStore, key: 'bouts.tournament.title_tail' })}
					</h3>
					<p class="bouts-card-meta">
						{t({
							locale: $localeStore,
							key: 'bouts.tournament.sub',
							params: { remaining: tournamentRemainingLeagues }
						})}
					</p>

					{#if myLeagueInTournament !== null}
						<div class="bouts-your-row is-tournament">
							<span class="bouts-your-em is-tournament" aria-hidden="true">★</span>
							<span class="bouts-your-text">
								<b>{t({ locale: $localeStore, key: 'bouts.tournament.your_league_in' })}</b>
								·
								{t({
									locale: $localeStore,
									key: 'bouts.your_rank',
									params: {
										rank: myLeagueInTournament.rank,
										total: tournamentRemainingLeagues
									}
								})}
							</span>
							<span class="num bouts-your-pct is-tournament">
								{t({ locale: $localeStore, key: 'bouts.tournament.active' })}
							</span>
						</div>
					{/if}

					<span class="bouts-see-all allcaps">
						{t({ locale: $localeStore, key: 'bouts.tournament.open_bracket' })}
					</span>
				</button>
			</section>
		{/if}

		<!-- ─── Your league bouts ────────────────────────────────── -->
		<section class="bouts-section" aria-label="Your league bouts">
			<header class="bouts-section-head">
				<span class="bouts-eyebrow allcaps">
					{t({ locale: $localeStore, key: 'bouts.section.your_league_bouts' })}
				</span>
				<button class="bouts-section-head-cta" onclick={() => (createOpen = true)} type="button">
					+ {t({ locale: $localeStore, key: 'bouts.section.challenge_cta' })}
				</button>
			</header>

			{#if bouts.length === 0}
				<div class="bouts-empty">
					<p class="serif-italic bouts-empty-lede">
						{t({ locale: $localeStore, key: 'bouts.empty.lede' })}
					</p>
					<p class="bouts-empty-sub">
						{t({ locale: $localeStore, key: 'bouts.empty.sub' })}
					</p>
					<button class="bouts-empty-cta" onclick={() => (createOpen = true)} type="button">
						+ {t({ locale: $localeStore, key: 'bouts.empty.cta' })}
					</button>
				</div>
			{:else}
				<ul class="bouts-list">
					{#each visibleLeagueBouts as bout (bout.id)}
						{@const owned = ownedSide(bout)}
						<li class="bouts-bout" data-state={bout.state}>
							<div class="bouts-bout-head">
								<div class="bouts-sides">
									<button
										style:--side-accent={sideAccent(bout.sideA)}
										class="bouts-side"
										data-known={membershipByLeagueId.has(bout.sideA)}
										data-ours={owned === bout.sideA}
										disabled={!myLeagueIds.has(bout.sideA)}
										onclick={() => goToLeague(bout.sideA)}
										type="button"
									>
										{sideLabel(bout.sideA)}
									</button>
									<span class="bouts-vs serif-italic">vs</span>
									<button
										style:--side-accent={sideAccent(bout.sideB)}
										class="bouts-side"
										data-known={membershipByLeagueId.has(bout.sideB)}
										data-ours={owned === bout.sideB}
										disabled={!myLeagueIds.has(bout.sideB)}
										onclick={() => goToLeague(bout.sideB)}
										type="button"
									>
										{sideLabel(bout.sideB)}
									</button>
								</div>
								<button class="bouts-state-link" onclick={() => goToBoutDetail(bout)} type="button">
									<span class="allcaps bouts-state" data-state={bout.state}>
										{t({ locale: $localeStore, key: boutStateLabelKey(bout.state) })}
									</span>
									<span aria-hidden="true">→</span>
								</button>
							</div>
							<p class="bouts-window num">
								{formatDate(bout.kickoffMs)} → {formatDate(bout.settleMs)}
							</p>
							{#if bout.state === 'resolved' && bout.winner !== undefined && owned !== undefined}
								<p class="bouts-winner allcaps" data-winner={bout.winner}>
									{#if bout.winner === 'draw'}
										{t({ locale: $localeStore, key: 'leagues.bout.winner_draw' })}
									{:else if (bout.winner === 'A' ? bout.sideA : bout.sideB) === owned}
										{t({ locale: $localeStore, key: 'leagues.bout.winner_us' })}
									{:else}
										{t({ locale: $localeStore, key: 'leagues.bout.winner_them' })}
									{/if}
									{#if bout.scoreA !== undefined && bout.scoreB !== undefined}
										<span class="num bouts-score">
											· {bout.sideA === owned
												? `${bout.scoreA}–${bout.scoreB}`
												: `${bout.scoreB}–${bout.scoreA}`}
										</span>
									{/if}
								</p>
							{/if}
							{#if canAcceptBout(bout)}
								<button
									class="bouts-action is-primary"
									disabled={actingBoutId === bout.id}
									onclick={() => handleAcceptBout(bout)}
									type="button"
								>
									{actingBoutId === bout.id
										? t({ locale: $localeStore, key: 'leagues.bout.action.accepting' })
										: t({ locale: $localeStore, key: 'leagues.bout.action.accept' })}
								</button>
							{:else if canKickoffBout(bout)}
								<button
									class="bouts-action is-primary"
									disabled={actingBoutId === bout.id}
									onclick={() => handleKickoffBout(bout)}
									type="button"
								>
									{actingBoutId === bout.id
										? t({ locale: $localeStore, key: 'leagues.bout.action.starting' })
										: t({ locale: $localeStore, key: 'leagues.bout.action.kickoff' })}
								</button>
							{:else if canResolveBout(bout)}
								<button
									class="bouts-action is-primary"
									onclick={() => openResolve(bout)}
									type="button"
								>
									{t({ locale: $localeStore, key: 'leagues.bout.action.resolve' })}
								</button>
							{/if}
							{#if canRetractBout(bout)}
								<button
									class="bouts-action is-danger"
									disabled={actingBoutId === bout.id}
									onclick={() => handleRetractBout(bout)}
									type="button"
								>
									{actingBoutId === bout.id
										? t({ locale: $localeStore, key: 'leagues.bout.action.retracting' })
										: t({ locale: $localeStore, key: 'leagues.bout.action.retract' })}
								</button>
							{/if}
						</li>
					{/each}
				</ul>
				{#if sortedLeagueBouts.length > LEAGUE_BOUT_PREVIEW}
					<button
						class="bouts-see-all is-button allcaps"
						onclick={() => (showAllLeagueBouts = !showAllLeagueBouts)}
						type="button"
					>
						{#if showAllLeagueBouts}
							{t({ locale: $localeStore, key: 'bouts.show_less' })}
						{:else}
							{t({
								locale: $localeStore,
								key: 'bouts.see_all',
								params: { count: sortedLeagueBouts.length }
							})}
						{/if}
					</button>
				{/if}
			{/if}
		</section>
	{/if}
</div>

{#if resolveBoutTarget !== null && resolveBoutOurSide !== null}
	<ResolveBoutModal
		bout={resolveBoutTarget}
		isOpen={true}
		onClose={() => {
			resolveBoutTarget = null;
			resolveBoutOurSide = null;
		}}
		onResolved={handleResolveDone}
		ourLeagueId={resolveBoutOurSide}
	/>
{/if}

<CreateBoutModal isOpen={createOpen} onClose={() => (createOpen = false)} />

<style lang="postcss">
	.bouts-inbox {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		padding: 0 1.25rem 6rem;
	}

	/* ─── intro card ─────────────────────────────────────────── */
	.bouts-intro {
		position: relative;
		margin: 0.25rem 0;
		padding: 0.9rem 1.1rem 0.85rem;
		background: color-mix(in srgb, #e2b842 4%, transparent);
		border: 1px solid color-mix(in srgb, #e2b842 18%, var(--border-base));
		border-radius: var(--r-12);
	}

	.bouts-intro-lede {
		display: block;
		margin-bottom: 0.25rem;
		font-size: var(--t-13);
		color: var(--laurel);
	}

	.bouts-intro-body {
		margin: 0;
		padding-right: 1.4rem;
		font-size: var(--t-13);
		line-height: 1.5;
		color: var(--text-muted);
	}

	.bouts-intro-dismiss {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		appearance: none;
		width: 24px;
		height: 24px;
		font-size: 1.15rem;
		color: var(--text-muted);
		background: transparent;
		border: 0;
		cursor: pointer;
	}

	/* ─── status / error ─────────────────────────────────────── */
	.bouts-inbox-status,
	.bouts-inbox-error {
		margin: 0;
		padding: 1rem;
		font-size: var(--t-13);
		border-radius: var(--r-12);
	}

	.bouts-inbox-status {
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
	}

	.bouts-inbox-error {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	/* ─── section ────────────────────────────────────────────── */
	.bouts-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.bouts-section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		margin-bottom: 0.1rem;
	}

	.bouts-eyebrow {
		font-size: var(--t-10, 0.65rem);
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
	}

	.bouts-section-head-meta {
		font-size: var(--t-10, 0.6rem);
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}

	.bouts-section-head-cta {
		appearance: none;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.3rem 0.7rem;
		font: inherit;
		font-size: var(--t-11, 0.7rem);
		font-weight: 700;
		color: var(--laurel);
		background: color-mix(in srgb, var(--laurel) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--laurel) 25%, var(--border-base));
		border-radius: var(--r-pill);
		cursor: pointer;
	}

	.bouts-section-head-cta:hover {
		background: color-mix(in srgb, var(--laurel) 14%, transparent);
	}

	/* ─── grouped card ───────────────────────────────────────── */
	.bouts-card {
		appearance: none;
		display: block;
		width: 100%;
		padding: 0.9rem;
		font: inherit;
		text-align: left;
		color: var(--text-base);
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--laurel) 10%, transparent), transparent 70%),
			var(--bg-surface);
		border: 1px solid color-mix(in srgb, var(--laurel) 22%, var(--border-base));
		border-radius: var(--r-14, 0.85rem);
		cursor: pointer;
		transition: border-color 160ms ease;
	}

	.bouts-card:hover {
		border-color: color-mix(in srgb, var(--laurel) 38%, var(--border-base));
	}

	.bouts-card.is-compact {
		padding: 0.75rem 0.9rem;
	}

	.bouts-card.is-tournament {
		background:
			linear-gradient(180deg, color-mix(in srgb, #b49cff 10%, transparent), transparent 70%),
			var(--bg-surface);
		border-color: color-mix(in srgb, #b49cff 28%, var(--border-base));
	}

	.bouts-card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.4rem;
	}

	.bouts-card-tags {
		display: inline-flex;
		gap: 0.3rem;
	}

	.bouts-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.15rem 0.4rem;
		font-family: var(--font-mono, var(--font-sans));
		font-size: var(--t-10, 0.6rem);
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		border-radius: var(--r-4, 0.25rem);
	}

	.bouts-tag.is-wc {
		background: color-mix(in srgb, #ff6b2a 14%, transparent);
		color: #ff8a4c;
	}

	.bouts-tag.is-live {
		background: color-mix(in srgb, var(--no) 14%, transparent);
		color: var(--no);
	}

	.bouts-tag.is-live::before {
		content: '';
		width: 5px;
		height: 5px;
		border-radius: var(--r-pill);
		background: var(--no);
	}

	.bouts-tag.is-monthly {
		background: color-mix(in srgb, var(--laurel) 12%, transparent);
		color: var(--laurel);
	}

	.bouts-tag.is-tournament-round {
		background: color-mix(in srgb, #b49cff 16%, transparent);
		color: #b49cff;
		border: 1px solid color-mix(in srgb, #b49cff 30%, transparent);
	}

	.bouts-card-timer {
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
	}

	.bouts-card-title {
		margin: 0 0 0.25rem;
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: var(--t-15, 0.95rem);
		line-height: 1.25;
		letter-spacing: -0.01em;
		color: var(--text-base);
		text-wrap: balance;
	}

	.bouts-card-title .serif-italic {
		color: var(--laurel);
		font-weight: 400;
	}

	.bouts-card.is-tournament .bouts-card-title .serif-italic {
		color: #b49cff;
	}

	.bouts-card-meta {
		margin: 0 0 0.6rem;
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
		letter-spacing: 0.04em;
	}

	/* ─── podium ─────────────────────────────────────────────── */
	.bouts-podium {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.4rem;
		margin-bottom: 0.6rem;
	}

	.bouts-pod-tile {
		padding: 0.55rem 0.3rem;
		text-align: center;
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-10, 0.6rem);
	}

	.bouts-pod-tile.is-gold {
		background:
			linear-gradient(180deg, color-mix(in srgb, #e2b842 14%, transparent), transparent 70%),
			var(--bg-surface);
		border-color: color-mix(in srgb, #e2b842 40%, var(--border-base));
	}

	.bouts-pod-tile.is-silver {
		background:
			linear-gradient(180deg, color-mix(in srgb, #c0c5cb 14%, transparent), transparent 70%),
			var(--bg-surface);
	}

	.bouts-pod-tile.is-bronze {
		background:
			linear-gradient(180deg, color-mix(in srgb, #b57c52 14%, transparent), transparent 70%),
			var(--bg-surface);
	}

	.bouts-pod-place {
		font-size: var(--t-14, 0.9rem);
		font-weight: 700;
		color: var(--text-muted);
	}

	.bouts-pod-tile.is-gold .bouts-pod-place {
		color: #e2b842;
	}

	.bouts-pod-tile.is-silver .bouts-pod-place {
		color: #c0c5cb;
	}

	.bouts-pod-tile.is-bronze .bouts-pod-place {
		color: #b57c52;
	}

	.bouts-pod-name {
		margin-top: 0.18rem;
		font-size: var(--t-11, 0.7rem);
		font-weight: 600;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.bouts-pod-pct {
		margin-top: 0.1rem;
		font-size: var(--t-10, 0.6rem);
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}

	.bouts-pod-tile.is-gold .bouts-pod-pct {
		color: #e2b842;
		font-weight: 700;
	}

	/* ─── your-row inside grouped card ──────────────────────── */
	.bouts-your-row {
		display: grid;
		grid-template-columns: 28px 1fr auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.6rem;
		background: color-mix(in srgb, var(--laurel) 6%, transparent);
		border: 1px solid color-mix(in srgb, var(--laurel) 18%, var(--border-base));
		border-radius: var(--r-10, 0.6rem);
	}

	.bouts-your-row.is-tight {
		margin-top: 0.3rem;
	}

	.bouts-your-row.is-tournament {
		background: color-mix(in srgb, #b49cff 8%, transparent);
		border-color: color-mix(in srgb, #b49cff 22%, var(--border-base));
	}

	.bouts-your-em {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--t-13);
		color: var(--text-base);
		background: color-mix(in srgb, var(--laurel) 14%, transparent);
		border-radius: var(--r-pill);
	}

	.bouts-your-em.is-tournament {
		color: #b49cff;
		background: color-mix(in srgb, #b49cff 16%, transparent);
	}

	.bouts-your-text {
		font-size: var(--t-12);
		color: var(--text-base);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bouts-your-pct {
		font-size: var(--t-13);
		font-weight: 700;
		color: var(--laurel);
	}

	.bouts-your-pct.is-tournament {
		color: #b49cff;
		font-size: var(--t-11, 0.7rem);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	/* ─── see-all ───────────────────────────────────────────── */
	.bouts-see-all {
		display: block;
		margin-top: 0.55rem;
		font-family: var(--font-mono, var(--font-sans));
		font-size: var(--t-10, 0.65rem);
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--laurel);
	}

	.bouts-card.is-tournament .bouts-see-all {
		color: #b49cff;
	}

	.bouts-see-all.is-button {
		appearance: none;
		width: 100%;
		padding: 0.75rem 0;
		text-align: center;
		background: transparent;
		border: 0;
		cursor: pointer;
	}

	/* ─── league-bout list ──────────────────────────────────── */
	.bouts-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		padding: 1.5rem 1rem;
		text-align: center;
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px dashed var(--border-base);
		border-radius: var(--r-12);
	}

	.bouts-empty-lede {
		margin: 0;
		font-size: var(--t-15, 0.95rem);
		color: var(--laurel);
	}

	.bouts-empty-sub {
		margin: 0;
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.bouts-empty-cta {
		appearance: none;
		margin-top: 0.55rem;
		padding: 0.45rem 0.95rem;
		font: inherit;
		font-size: var(--t-12);
		font-weight: 700;
		color: var(--laurel);
		background: color-mix(in srgb, var(--laurel) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--laurel) 25%, var(--border-base));
		border-radius: var(--r-pill);
		cursor: pointer;
		transition: background 140ms ease;
	}

	.bouts-empty-cta:hover {
		background: color-mix(in srgb, var(--laurel) 14%, transparent);
	}

	.bouts-list {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.bouts-bout {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.75rem 0.9rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.bouts-bout[data-state='in_flight'] {
		border-color: color-mix(in srgb, var(--laurel) 38%, var(--border-base));
	}

	.bouts-bout-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.bouts-sides {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		flex-wrap: wrap;
		min-width: 0;
	}

	/* Side chip — emblem-tinted: direct accentColor background at 13%
	   opacity with a 30% border. Mirrors the prototype's
	   `worlds-tag` palette where the chip wears the school / league
	   tone instead of the generic laurel. */
	.bouts-side {
		appearance: none;
		padding: 0.2rem 0.5rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-base);
		background: color-mix(in srgb, var(--side-accent) 13%, transparent);
		border: 1px solid color-mix(in srgb, var(--side-accent) 30%, var(--border-base));
		border-radius: var(--r-pill);
		cursor: pointer;
	}

	.bouts-side:disabled {
		cursor: default;
		color: var(--text-muted);
		background: none;
		border-color: var(--border-base);
	}

	.bouts-side[data-ours='true'] {
		font-weight: 700;
		color: var(--side-accent);
	}

	.bouts-vs {
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.bouts-state-link {
		appearance: none;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0;
		font: inherit;
		color: var(--text-muted);
		background: none;
		border: none;
		cursor: pointer;
	}

	.bouts-state-link:hover {
		color: var(--text-base);
	}

	.bouts-state {
		font-size: var(--t-10, 0.65rem);
		letter-spacing: var(--tracking-allcaps);
		padding: 0.1rem 0.4rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-muted) 18%, transparent);
		color: var(--text-muted);
	}

	.bouts-state[data-state='in_flight'] {
		background: color-mix(in srgb, var(--laurel) 22%, transparent);
		color: var(--laurel);
	}

	.bouts-state[data-state='resolved'] {
		background: color-mix(in srgb, var(--text-muted) 12%, transparent);
		opacity: 0.7;
	}

	.bouts-window {
		margin: 0;
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
	}

	.bouts-winner {
		margin: 0;
		font-size: var(--t-11, 0.7rem);
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
	}

	.bouts-score {
		margin-left: 0.25rem;
		color: var(--text-base);
	}

	.bouts-action {
		appearance: none;
		align-self: flex-start;
		margin-top: 0.3rem;
		padding: 0.4rem 0.85rem;
		font: inherit;
		font-size: var(--t-12);
		font-weight: 700;
		border-radius: var(--r-pill);
		cursor: pointer;
		transition:
			background 140ms ease,
			border-color 140ms ease;
	}

	.bouts-action.is-primary {
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
	}

	.bouts-action.is-primary:hover:not(:disabled) {
		background: color-mix(in srgb, var(--laurel) 88%, var(--text-base));
	}

	.bouts-action.is-danger {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	.bouts-action.is-danger:hover:not(:disabled) {
		background: color-mix(in srgb, var(--no-wash, var(--no)) 20%, transparent);
	}

	.bouts-action:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
