<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import BattlesIntroCard from '$lib/components/leagues/BattlesIntroCard.svelte';
	import CreateBattleModal from '$lib/components/leagues/CreateBattleModal.svelte';
	import ResolveBattleModal from '$lib/components/leagues/ResolveBattleModal.svelte';
	import CountryFlag from '$lib/components/ui/CountryFlag.svelte';
	import { DAY_IN_MS } from '$lib/constants/app.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import {
		lookupWorldsAffiliation,
		WORLDS_COUNTRIES,
		WORLDS_UNIVERSITIES
	} from '$lib/constants/worlds-affiliations.constants';
	import { daysToFinal } from '$lib/derived/featured-event.derived';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import {
		acceptBattle,
		kickoffBattle,
		listMyBattles,
		listMyLeagues,
		retractBattle,
		type LeagueWithRole
	} from '$lib/services/leagues.services';
	import { getCurrentTournament } from '$lib/services/tournament.services';
	import { listAffiliationStats, listMyAffiliations } from '$lib/services/worlds.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { AffiliationDoc } from '$lib/types/affiliation';
	import type { AffiliationStatsDoc } from '$lib/types/affiliation-stats';
	import type { BattleDoc } from '$lib/types/battle';
	import {
		TOURNAMENT_ROUNDS,
		type TournamentDoc,
		type TournamentMatchDoc,
		type TournamentRound
	} from '$lib/types/tournament';
	import {
		affiliationLifetimeAccuracy,
		affiliationMonthlyAccuracy,
		formatAccuracyPercent
	} from '$lib/utils/affiliation-stats.utils';
	import { formatDate } from '$lib/utils/format.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { goBack } from '$lib/utils/nav.utils';

	/**
	 * Battles inbox.
	 *
	 * The page is composed of four surface-grouped sections (grouped
	 * by **surface**, never by battle state):
	 *
	 *  1. Optional "What's a battle?" intro card — dismissible, persists
	 *     via `localStorage['vici.battles-intro-seen']`. The locked
	 *     design calls for cross-device `preferences` storage; that
	 *     is deferred until the satellite `preferences` schema can be
	 *     migrated without a Candid + Rust binding regen.
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
	 *  5. Your league battles — the cross-league inbox, with a
	 *     `Challenge` pill on the right of the section eyebrow.
	 *
	 * Side chips use the league's `accentColor` directly (13 % opacity
	 * background, 30 % border) so each league's emblem tone reads on
	 * the card surface rather than the generic laurel.
	 */

	interface Props {
		// When true, hide the page's own appbar — the container is
		// expected to render one (e.g. the tabbed Arena parent).
		embedded?: boolean;
	}

	const { embedded = false }: Props = $props();

	// ─── Battles inbox state ──────────────────────────────────────────
	let battles: BattleDoc[] = $state([]);
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
	// Persisted via the `vici.battles-intro-seen` localStorage flag.
	// Future migration to cross-device preferences is deferred — adding
	// a new field to the satellite preferences schema requires a
	// Candid + Rust binding regen scoped outside this work.
	const BATTLES_INTRO_KEY = 'vici.battles-intro-seen';
	let battlesIntroSeen = $state(false);

	const load = async () => {
		try {
			const [battleList, mineList, identity, affils, schools, countries, tour] = await Promise.all([
				listMyBattles(),
				listMyLeagues(),
				safeGetIdentityOnce(),
				listMyAffiliations(),
				listAffiliationStats({ kind: 'university' }),
				listAffiliationStats({ kind: 'country' }),
				getCurrentTournament()
			]);
			battles = battleList;
			memberships = mineList;
			selfPrincipal = identity.getPrincipal().toText();
			myUni = affils.university;
			myCountry = affils.country;
			uniStats = schools;
			countryStats = countries;
			({ tournament, matches } = tour);
			loadState = 'ready';
		} catch (err) {
			console.error('BattlesInboxPage: load failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
			loadState = 'error';
		}
	};

	onMount(() => {
		if (browser) {
			try {
				battlesIntroSeen = localStorage.getItem(BATTLES_INTRO_KEY) === '1';
			} catch {
				// Storage unavailable — keep the intro visible.
			}
		}

		void load();
	});

	const dismissIntro = () => {
		battlesIntroSeen = true;

		if (browser) {
			try {
				localStorage.setItem(BATTLES_INTRO_KEY, '1');
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

	const battleStateLabelKey = (state: BattleDoc['state']): MessageKey => {
		switch (state) {
			case 'proposed':
				return 'leagues.battle.state.proposed';
			case 'accepted':
				return 'leagues.battle.state.accepted';
			case 'in_flight':
				return 'leagues.battle.state.in_flight';
			case 'resolved':
				return 'leagues.battle.state.resolved';
		}
	};

	const ownedSide = (battle: BattleDoc): string | undefined => {
		const a = membershipByLeagueId.get(battle.sideA);

		if (a?.role === 'owner') {
			return battle.sideA;
		}

		const b = membershipByLeagueId.get(battle.sideB);

		return b?.role === 'owner' ? battle.sideB : undefined;
	};

	const canAcceptBattle = (battle: BattleDoc): boolean => {
		const owned = ownedSide(battle);

		return owned !== undefined && battle.state === 'proposed' && battle.sideB === owned;
	};

	const canKickoffBattle = (battle: BattleDoc): boolean =>
		ownedSide(battle) !== undefined &&
		battle.state === 'accepted' &&
		Date.now() >= battle.kickoffMs;

	const canResolveBattle = (battle: BattleDoc): boolean =>
		ownedSide(battle) !== undefined &&
		battle.state === 'in_flight' &&
		Date.now() >= battle.settleMs;

	const canRetractBattle = (battle: BattleDoc): boolean =>
		battle.state === 'proposed' && selfPrincipal !== undefined && battle.proposer === selfPrincipal;

	let actingBattleId = $state<string | null>(null);
	let resolveBattleTarget = $state<BattleDoc | null>(null);
	let resolveBattleOurSide = $state<string | null>(null);

	const handleAcceptBattle = async (battle: BattleDoc) => {
		if (actingBattleId !== null) {
			return;
		}

		actingBattleId = battle.id;

		try {
			await acceptBattle({ battle });
			await load();
		} catch (err) {
			console.error('BattlesInboxPage: acceptBattle failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBattleId = null;
		}
	};

	const handleKickoffBattle = async (battle: BattleDoc) => {
		if (actingBattleId !== null) {
			return;
		}

		actingBattleId = battle.id;

		try {
			await kickoffBattle({ battle });
			await load();
		} catch (err) {
			console.error('BattlesInboxPage: kickoffBattle failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBattleId = null;
		}
	};

	const openResolve = (battle: BattleDoc) => {
		const owned = ownedSide(battle);

		if (owned === undefined) {
			return;
		}

		resolveBattleTarget = battle;
		resolveBattleOurSide = owned;
	};

	const handleRetractBattle = async (battle: BattleDoc) => {
		if (actingBattleId !== null) {
			return;
		}

		actingBattleId = battle.id;

		try {
			await retractBattle({ battle });
			await load();
		} catch (err) {
			console.error('BattlesInboxPage: retractBattle failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBattleId = null;
		}
	};

	const handleResolveDone = () => {
		resolveBattleTarget = null;
		resolveBattleOurSide = null;
		void load();
	};

	const goToLeague = (leagueId: string) => {
		if (!myLeagueIds.has(leagueId)) {
			return;
		}

		void goto(`${resolve(AppPath.Arena)}/leagues/${leagueId}`);
	};

	const goToBattleDetail = (battle: BattleDoc) => {
		void goto(`${resolve(AppPath.Arena)}/battles/${battle.id}`);
	};

	// ─── Worlds podium helpers ──────────────────────────────────────
	/**
	 * Top-3 by WC (lifetime) accuracy for a roster. The featured
	 * podium always frames the World Cup battle — same shape as
	 * WorldsPage's `wcTop3`.
	 */
	const wcTop3 = ({ stats }: { stats: AffiliationStatsDoc[] }): AffiliationStatsDoc[] => {
		const list = [...stats];

		list.sort((a, b) => {
			const da = affiliationLifetimeAccuracy(a);
			const db = affiliationLifetimeAccuracy(b);

			if (da !== db) {
				return db - da;
			}

			if (a.totalCalls !== b.totalCalls) {
				return b.totalCalls - a.totalCalls;
			}

			return a.affiliationIdentifier.localeCompare(b.affiliationIdentifier);
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
		affiliationIdentifier
	}: {
		stats: AffiliationStatsDoc[];
		affiliationIdentifier: string | undefined;
	}): number => {
		if (affiliationIdentifier === undefined) {
			return 0;
		}

		const sorted = [...stats].sort((a, b) => {
			const da = affiliationLifetimeAccuracy(a);
			const db = affiliationLifetimeAccuracy(b);

			if (da !== db) {
				return db - da;
			}

			if (a.totalCalls !== b.totalCalls) {
				return b.totalCalls - a.totalCalls;
			}

			return a.affiliationIdentifier.localeCompare(b.affiliationIdentifier);
		});

		const idx = sorted.findIndex((s) => s.affiliationIdentifier === affiliationIdentifier);

		return idx === -1 ? 0 : idx + 1;
	};

	const myUniStats = $derived.by(() => {
		const uni = myUni;

		return uni
			? uniStats.find((s) => s.affiliationIdentifier === uni.affiliationIdentifier)
			: undefined;
	});

	const myUniRank = $derived(
		rankIn({ stats: uniStats, affiliationIdentifier: myUni?.affiliationIdentifier })
	);

	const myCountryStats = $derived.by(() => {
		const country = myCountry;

		return country
			? countryStats.find((s) => s.affiliationIdentifier === country.affiliationIdentifier)
			: undefined;
	});

	const myCountryRank = $derived(
		rankIn({ stats: countryStats, affiliationIdentifier: myCountry?.affiliationIdentifier })
	);

	const universityCount = WORLDS_UNIVERSITIES.length;
	const countryCount = WORLDS_COUNTRIES.length;

	const eventDaysLeft = $derived($daysToFinal);

	const uniOption = (id: string) => lookupWorldsAffiliation({ kind: 'university', id });
	const countryOption = (id: string) => lookupWorldsAffiliation({ kind: 'country', id });

	const goWorldsUniversitiesWc = () => {
		void goto(`${resolve(AppPath.Arena)}/worlds/schools`);
	};

	const goWorldsUniversitiesMonth = () => {
		void goto(`${resolve(AppPath.Arena)}/worlds/schools?scope=month`);
	};

	const goWorldsCountriesWc = () => {
		void goto(`${resolve(AppPath.Arena)}/worlds/countries`);
	};

	const goWorldsCountriesMonth = () => {
		void goto(`${resolve(AppPath.Arena)}/worlds/countries?scope=month`);
	};

	const goTournament = () => {
		void goto(`${resolve(AppPath.Arena)}/tournament`);
	};

	// ─── Tournament card derivations ────────────────────────────────
	/**
	 * Surface the tournament card only when the current bracket has
	 * at least one round in flight (a match whose window hasn't
	 * closed and that has unresolved matches). Tied to live data
	 * rather than a mocked status flag.
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

		return delta <= 0 ? 0 : Math.ceil(delta / DAY_IN_MS);
	});

	const tournamentRoundKey = (round: TournamentRound): MessageKey => {
		switch (round) {
			case 'r1':
				return 'battles.tournament.round.r1';
			case 'quarter':
				return 'battles.tournament.round.quarter';
			case 'semifinal':
				return 'battles.tournament.round.semifinal';
			case 'final':
				return 'battles.tournament.round.final';
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

	// ─── League battles list ──────────────────────────────────────────
	const BATTLE_SORT_ORDER: readonly BattleDoc['state'][] = [
		'in_flight',
		'accepted',
		'proposed',
		'resolved'
	] as const;

	const sortedLeagueBattles = $derived.by(() => {
		const order = new Map(BATTLE_SORT_ORDER.map((s, i) => [s, i]));

		return [...battles].sort((a, b) => {
			const oa = order.get(a.state) ?? 99;
			const ob = order.get(b.state) ?? 99;

			if (oa !== ob) {
				return oa - ob;
			}

			return b.kickoffMs - a.kickoffMs;
		});
	});

	const LEAGUE_BATTLE_PREVIEW = 4;
	let showAllLeagueBattles = $state(false);

	const visibleLeagueBattles = $derived(
		showAllLeagueBattles ? sortedLeagueBattles : sortedLeagueBattles.slice(0, LEAGUE_BATTLE_PREVIEW)
	);

	let createOpen = $state(false);
</script>

<div class="battles-inbox">
	{#if !embedded}
		<MobileAppBar
			align="left"
			back={{
				label: t({ locale: $localeStore, key: 'leagues.battles_inbox.back' }),
				onBack: () => goBack(resolve(AppPath.Arena))
			}}
			title={t({ locale: $localeStore, key: 'leagues.battles_inbox.title' })}
		/>
	{/if}

	{#if !battlesIntroSeen}
		<BattlesIntroCard onDismiss={dismissIntro} />
	{/if}

	{#if loadState === 'loading'}
		<p class="battles-inbox-status" aria-busy="true">
			{t({ locale: $localeStore, key: 'leagues.battles_inbox.loading' })}
		</p>
	{:else if loadState === 'error'}
		<p class="battles-inbox-error" role="alert">
			{errorMessage ?? t({ locale: $localeStore, key: 'leagues.error.generic' })}
		</p>
	{:else}
		<!-- ─── Worlds Universities ─────────────────────────────── -->
		<section class="battles-section" aria-label="Worlds Universities">
			<header class="battles-section-head">
				<span class="battles-eyebrow allcaps">
					{t({ locale: $localeStore, key: 'battles.section.worlds_universities' })}
				</span>
				{#if myUni}
					{@const opt = uniOption(myUni.affiliationIdentifier)}
					<span class="battles-section-head-meta num allcaps">
						{t({
							locale: $localeStore,
							key: 'battles.your_school',
							params: { name: opt?.name ?? myUni.affiliationIdentifier }
						})}
					</span>
				{/if}
			</header>

			<button class="battles-card is-featured" onclick={goWorldsUniversitiesWc} type="button">
				<div class="battles-card-head">
					<div class="battles-card-tags">
						<span class="battles-tag is-wc">
							{t({ locale: $localeStore, key: 'worlds.event.tag_wc' })}
						</span>
						<span class="battles-tag is-live">
							{t({ locale: $localeStore, key: 'worlds.event.tag_live' })}
						</span>
					</div>
					{#if eventDaysLeft !== null}
						<span class="battles-card-timer num">
							{t({
								locale: $localeStore,
								key: 'battles.card.days_left',
								params: { days: eventDaysLeft }
							})}
						</span>
					{/if}
				</div>
				<h3 class="battles-card-title">
					{t({ locale: $localeStore, key: 'battles.uni.wc_title_lede' })}
					<span class="serif-italic">
						{t({ locale: $localeStore, key: 'battles.uni.wc_title_emph' })}
					</span>
					{t({ locale: $localeStore, key: 'battles.uni.wc_title_tail' })}
				</h3>
				<p class="battles-card-meta">
					{t({
						locale: $localeStore,
						key: 'battles.uni.wc_sub',
						params: { schools: universityCount }
					})}
				</p>

				{#if uniWcTop3.length > 0}
					<div class="battles-podium">
						{#if uniWcTop3[1]}
							{@const opt = uniOption(uniWcTop3[1].affiliationIdentifier)}
							<div class="battles-pod-tile is-silver">
								<div class="num battles-pod-place">02</div>
								<div class="battles-pod-name">
									{opt?.name ?? uniWcTop3[1].affiliationIdentifier}
								</div>
								<div class="num battles-pod-pct">
									{formatAccuracyPercent(affiliationLifetimeAccuracy(uniWcTop3[1]))}
								</div>
							</div>
						{/if}
						{#if uniWcTop3[0]}
							{@const opt = uniOption(uniWcTop3[0].affiliationIdentifier)}
							<div class="battles-pod-tile is-gold">
								<div class="num battles-pod-place">01</div>
								<div class="battles-pod-name">
									{opt?.name ?? uniWcTop3[0].affiliationIdentifier}
								</div>
								<div class="num battles-pod-pct">
									{formatAccuracyPercent(affiliationLifetimeAccuracy(uniWcTop3[0]))}
								</div>
							</div>
						{/if}
						{#if uniWcTop3[2]}
							{@const opt = uniOption(uniWcTop3[2].affiliationIdentifier)}
							<div class="battles-pod-tile is-bronze">
								<div class="num battles-pod-place">03</div>
								<div class="battles-pod-name">
									{opt?.name ?? uniWcTop3[2].affiliationIdentifier}
								</div>
								<div class="num battles-pod-pct">
									{formatAccuracyPercent(affiliationLifetimeAccuracy(uniWcTop3[2]))}
								</div>
							</div>
						{/if}
					</div>
				{/if}

				{#if myUni && myUniStats}
					{@const opt = uniOption(myUni.affiliationIdentifier)}
					<div class="battles-your-row">
						<span class="battles-your-em" aria-hidden="true">
							{(opt?.name ?? myUni.affiliationIdentifier).charAt(0)}
						</span>
						<span class="battles-your-text">
							<b>{opt?.name ?? myUni.affiliationIdentifier}</b>
							·
							{t({
								locale: $localeStore,
								key: 'battles.your_rank',
								params: { rank: myUniRank, total: universityCount }
							})}
						</span>
						<span class="num battles-your-pct"
							>{formatAccuracyPercent(affiliationLifetimeAccuracy(myUniStats))}</span
						>
					</div>
				{/if}
			</button>

			<button class="battles-card is-compact" onclick={goWorldsUniversitiesMonth} type="button">
				<div class="battles-card-head">
					<span class="battles-tag is-monthly">
						{t({ locale: $localeStore, key: 'battles.tag.monthly_all_calls' })}
					</span>
				</div>
				{#if myUni && myUniStats}
					{@const opt = uniOption(myUni.affiliationIdentifier)}
					<div class="battles-your-row is-tight">
						<span class="battles-your-em" aria-hidden="true">
							{(opt?.name ?? myUni.affiliationIdentifier).charAt(0)}
						</span>
						<span class="battles-your-text">
							<b>{opt?.name ?? myUni.affiliationIdentifier}</b>
							·
							{t({
								locale: $localeStore,
								key: 'battles.your_rank',
								params: { rank: myUniRank, total: universityCount }
							})}
						</span>
						<span class="num battles-your-pct"
							>{formatAccuracyPercent(affiliationMonthlyAccuracy(myUniStats))}</span
						>
					</div>
				{:else}
					<p class="battles-card-meta">
						{t({
							locale: $localeStore,
							key: 'battles.uni.month_pick',
							params: { count: universityCount }
						})}
					</p>
				{/if}
				<span class="battles-see-all allcaps">
					{t({ locale: $localeStore, key: 'battles.see_full_standings' })}
				</span>
			</button>
		</section>

		<!-- ─── Worlds Countries ────────────────────────────────── -->
		<section class="battles-section" aria-label="Worlds Countries">
			<header class="battles-section-head">
				<span class="battles-eyebrow allcaps">
					{t({ locale: $localeStore, key: 'battles.section.worlds_countries' })}
				</span>
				{#if myCountry}
					{@const opt = countryOption(myCountry.affiliationIdentifier)}
					<span class="battles-section-head-meta num allcaps">
						{#if opt}<CountryFlag class="battles-section-flag" countryCode={opt.id} />{/if}
						{(opt?.name ?? myCountry.affiliationIdentifier).toUpperCase()}
					</span>
				{/if}
			</header>

			<button class="battles-card is-featured" onclick={goWorldsCountriesWc} type="button">
				<div class="battles-card-head">
					<div class="battles-card-tags">
						<span class="battles-tag is-wc">
							{t({ locale: $localeStore, key: 'worlds.event.tag_wc' })}
						</span>
						<span class="battles-tag is-live">
							{t({ locale: $localeStore, key: 'worlds.event.tag_live' })}
						</span>
					</div>
					{#if eventDaysLeft !== null}
						<span class="battles-card-timer num">
							{t({
								locale: $localeStore,
								key: 'battles.card.days_left',
								params: { days: eventDaysLeft }
							})}
						</span>
					{/if}
				</div>
				<h3 class="battles-card-title">
					{t({ locale: $localeStore, key: 'battles.country.wc_title_lede' })}
					<span class="serif-italic">
						{t({ locale: $localeStore, key: 'battles.country.wc_title_emph' })}
					</span>
					{t({ locale: $localeStore, key: 'battles.country.wc_title_tail' })}
				</h3>
				<p class="battles-card-meta">
					{t({
						locale: $localeStore,
						key: 'battles.country.wc_sub',
						params: { nations: countryCount }
					})}
				</p>

				{#if countryWcTop3.length > 0}
					<div class="battles-podium">
						{#if countryWcTop3[1]}
							{@const opt = countryOption(countryWcTop3[1].affiliationIdentifier)}
							<div class="battles-pod-tile is-silver">
								<div class="num battles-pod-place">02</div>
								<div class="battles-pod-name">
									{#if opt}<CountryFlag class="battles-pod-flag" countryCode={opt.id} />{/if}
									{opt?.name ?? countryWcTop3[1].affiliationIdentifier}
								</div>
								<div class="num battles-pod-pct">
									{formatAccuracyPercent(affiliationLifetimeAccuracy(countryWcTop3[1]))}
								</div>
							</div>
						{/if}
						{#if countryWcTop3[0]}
							{@const opt = countryOption(countryWcTop3[0].affiliationIdentifier)}
							<div class="battles-pod-tile is-gold">
								<div class="num battles-pod-place">01</div>
								<div class="battles-pod-name">
									{#if opt}<CountryFlag class="battles-pod-flag" countryCode={opt.id} />{/if}
									{opt?.name ?? countryWcTop3[0].affiliationIdentifier}
								</div>
								<div class="num battles-pod-pct">
									{formatAccuracyPercent(affiliationLifetimeAccuracy(countryWcTop3[0]))}
								</div>
							</div>
						{/if}
						{#if countryWcTop3[2]}
							{@const opt = countryOption(countryWcTop3[2].affiliationIdentifier)}
							<div class="battles-pod-tile is-bronze">
								<div class="num battles-pod-place">03</div>
								<div class="battles-pod-name">
									{#if opt}<CountryFlag class="battles-pod-flag" countryCode={opt.id} />{/if}
									{opt?.name ?? countryWcTop3[2].affiliationIdentifier}
								</div>
								<div class="num battles-pod-pct">
									{formatAccuracyPercent(affiliationLifetimeAccuracy(countryWcTop3[2]))}
								</div>
							</div>
						{/if}
					</div>
				{/if}

				{#if myCountry && myCountryStats}
					{@const opt = countryOption(myCountry.affiliationIdentifier)}
					<div class="battles-your-row">
						<span class="battles-your-em" aria-hidden="true">
							{#if opt}<CountryFlag class="battles-your-flag" countryCode={opt.id} />{/if}
						</span>
						<span class="battles-your-text">
							<b>{opt?.name ?? myCountry.affiliationIdentifier}</b>
							·
							{t({
								locale: $localeStore,
								key: 'battles.your_rank',
								params: { rank: myCountryRank, total: countryCount }
							})}
						</span>
						<span class="num battles-your-pct"
							>{formatAccuracyPercent(affiliationLifetimeAccuracy(myCountryStats))}</span
						>
					</div>
				{/if}
			</button>

			<button class="battles-card is-compact" onclick={goWorldsCountriesMonth} type="button">
				<div class="battles-card-head">
					<span class="battles-tag is-monthly">
						{t({ locale: $localeStore, key: 'battles.tag.monthly_all_calls' })}
					</span>
				</div>
				{#if myCountry && myCountryStats}
					{@const opt = countryOption(myCountry.affiliationIdentifier)}
					<div class="battles-your-row is-tight">
						<span class="battles-your-em" aria-hidden="true">
							{#if opt}<CountryFlag class="battles-your-flag" countryCode={opt.id} />{/if}
						</span>
						<span class="battles-your-text">
							<b>{opt?.name ?? myCountry.affiliationIdentifier}</b>
							·
							{t({
								locale: $localeStore,
								key: 'battles.your_rank',
								params: { rank: myCountryRank, total: countryCount }
							})}
						</span>
						<span class="num battles-your-pct"
							>{formatAccuracyPercent(affiliationMonthlyAccuracy(myCountryStats))}</span
						>
					</div>
				{:else}
					<p class="battles-card-meta">
						{t({
							locale: $localeStore,
							key: 'battles.country.month_pick',
							params: { count: countryCount }
						})}
					</p>
				{/if}
				<span class="battles-see-all allcaps">
					{t({ locale: $localeStore, key: 'battles.see_full_standings' })}
				</span>
			</button>
		</section>

		<!-- ─── Monthly Tournament (curated, when active) ─────── -->
		{#if tournament !== null && tournamentLiveRound !== null}
			<section class="battles-section" aria-label="Tournament">
				<header class="battles-section-head">
					<span class="battles-eyebrow allcaps">
						{t({ locale: $localeStore, key: 'battles.section.tournament' })}
					</span>
					<span class="battles-section-head-meta num allcaps">
						{t({ locale: $localeStore, key: 'battles.tournament.meta' })}
					</span>
				</header>

				<button class="battles-card is-featured is-tournament" onclick={goTournament} type="button">
					<div class="battles-card-head">
						<div class="battles-card-tags">
							<span class="battles-tag is-tournament-round">
								{t({ locale: $localeStore, key: tournamentRoundKey(tournamentLiveRound) })}
							</span>
							<span class="battles-tag is-live">
								{t({ locale: $localeStore, key: 'worlds.event.tag_live' })}
							</span>
						</div>
						{#if tournamentDaysLeft !== null}
							<span class="battles-card-timer num">
								{t({
									locale: $localeStore,
									key: 'battles.card.days_left',
									params: { days: tournamentDaysLeft }
								})}
							</span>
						{/if}
					</div>
					<h3 class="battles-card-title">
						{t({ locale: $localeStore, key: 'battles.tournament.title_lede' })}
						<span class="serif-italic">
							{t({
								locale: $localeStore,
								key: 'battles.tournament.title_emph',
								params: { size: tournament.bracketSize }
							})}
						</span>
						{t({ locale: $localeStore, key: 'battles.tournament.title_tail' })}
					</h3>
					<p class="battles-card-meta">
						{t({
							locale: $localeStore,
							key: 'battles.tournament.sub',
							params: { remaining: tournamentRemainingLeagues }
						})}
					</p>

					{#if myLeagueInTournament !== null}
						<div class="battles-your-row is-tournament">
							<span class="battles-your-em is-tournament" aria-hidden="true">★</span>
							<span class="battles-your-text">
								<b>{t({ locale: $localeStore, key: 'battles.tournament.your_league_in' })}</b>
								·
								{t({
									locale: $localeStore,
									key: 'battles.your_rank',
									params: {
										rank: myLeagueInTournament.rank,
										total: tournamentRemainingLeagues
									}
								})}
							</span>
							<span class="num battles-your-pct is-tournament">
								{t({ locale: $localeStore, key: 'battles.tournament.active' })}
							</span>
						</div>
					{/if}

					<span class="battles-see-all allcaps">
						{t({ locale: $localeStore, key: 'battles.tournament.open_bracket' })}
					</span>
				</button>
			</section>
		{/if}

		<!-- ─── Your league battles ────────────────────────────────── -->
		<section class="battles-section" aria-label="Your league battles">
			<header class="battles-section-head">
				<span class="battles-eyebrow allcaps">
					{t({ locale: $localeStore, key: 'battles.section.your_league_battles' })}
				</span>
				<button class="battles-section-head-cta" onclick={() => (createOpen = true)} type="button">
					+ {t({ locale: $localeStore, key: 'battles.section.challenge_cta' })}
				</button>
			</header>

			{#if battles.length === 0}
				<div class="battles-empty">
					<p class="serif-italic battles-empty-lede">
						{t({ locale: $localeStore, key: 'battles.empty.lede' })}
					</p>
					<p class="battles-empty-sub">
						{t({ locale: $localeStore, key: 'battles.empty.sub' })}
					</p>
					<button class="battles-empty-cta" onclick={() => (createOpen = true)} type="button">
						+ {t({ locale: $localeStore, key: 'battles.empty.cta' })}
					</button>
				</div>
			{:else}
				<ul class="battles-list">
					{#each visibleLeagueBattles as battle (battle.id)}
						{@const owned = ownedSide(battle)}
						<li class="battles-battle" data-state={battle.state}>
							<div class="battles-battle-head">
								<div class="battles-sides">
									<button
										style:--side-accent={sideAccent(battle.sideA)}
										class="battles-side"
										data-known={membershipByLeagueId.has(battle.sideA)}
										data-ours={owned === battle.sideA}
										disabled={!myLeagueIds.has(battle.sideA)}
										onclick={() => goToLeague(battle.sideA)}
										type="button"
									>
										{sideLabel(battle.sideA)}
									</button>
									<span class="battles-vs serif-italic">vs</span>
									<button
										style:--side-accent={sideAccent(battle.sideB)}
										class="battles-side"
										data-known={membershipByLeagueId.has(battle.sideB)}
										data-ours={owned === battle.sideB}
										disabled={!myLeagueIds.has(battle.sideB)}
										onclick={() => goToLeague(battle.sideB)}
										type="button"
									>
										{sideLabel(battle.sideB)}
									</button>
								</div>
								<button
									class="battles-state-link"
									onclick={() => goToBattleDetail(battle)}
									type="button"
								>
									<span class="allcaps battles-state" data-state={battle.state}>
										{t({ locale: $localeStore, key: battleStateLabelKey(battle.state) })}
									</span>
									<span aria-hidden="true">→</span>
								</button>
							</div>
							<p class="battles-window num">
								{formatDate(battle.kickoffMs)} → {formatDate(battle.settleMs)}
							</p>
							{#if battle.state === 'resolved' && battle.winner !== undefined && owned !== undefined}
								<p class="battles-winner allcaps" data-winner={battle.winner}>
									{#if battle.winner === 'draw'}
										{t({ locale: $localeStore, key: 'leagues.battle.winner_draw' })}
									{:else if (battle.winner === 'A' ? battle.sideA : battle.sideB) === owned}
										{t({ locale: $localeStore, key: 'leagues.battle.winner_us' })}
									{:else}
										{t({ locale: $localeStore, key: 'leagues.battle.winner_them' })}
									{/if}
									{#if battle.scoreA !== undefined && battle.scoreB !== undefined}
										<span class="num battles-score">
											· {battle.sideA === owned
												? `${battle.scoreA}–${battle.scoreB}`
												: `${battle.scoreB}–${battle.scoreA}`}
										</span>
									{/if}
								</p>
							{/if}
							{#if canAcceptBattle(battle)}
								<button
									class="battles-action is-primary"
									disabled={actingBattleId === battle.id}
									onclick={() => handleAcceptBattle(battle)}
									type="button"
								>
									{actingBattleId === battle.id
										? t({ locale: $localeStore, key: 'leagues.battle.action.accepting' })
										: t({ locale: $localeStore, key: 'leagues.battle.action.accept' })}
								</button>
							{:else if canKickoffBattle(battle)}
								<button
									class="battles-action is-primary"
									disabled={actingBattleId === battle.id}
									onclick={() => handleKickoffBattle(battle)}
									type="button"
								>
									{actingBattleId === battle.id
										? t({ locale: $localeStore, key: 'leagues.battle.action.starting' })
										: t({ locale: $localeStore, key: 'leagues.battle.action.kickoff' })}
								</button>
							{:else if canResolveBattle(battle)}
								<button
									class="battles-action is-primary"
									onclick={() => openResolve(battle)}
									type="button"
								>
									{t({ locale: $localeStore, key: 'leagues.battle.action.resolve' })}
								</button>
							{/if}
							{#if canRetractBattle(battle)}
								<button
									class="battles-action is-danger"
									disabled={actingBattleId === battle.id}
									onclick={() => handleRetractBattle(battle)}
									type="button"
								>
									{actingBattleId === battle.id
										? t({ locale: $localeStore, key: 'leagues.battle.action.retracting' })
										: t({ locale: $localeStore, key: 'leagues.battle.action.retract' })}
								</button>
							{/if}
						</li>
					{/each}
				</ul>
				{#if sortedLeagueBattles.length > LEAGUE_BATTLE_PREVIEW}
					<button
						class="battles-see-all is-button allcaps"
						onclick={() => (showAllLeagueBattles = !showAllLeagueBattles)}
						type="button"
					>
						{#if showAllLeagueBattles}
							{t({ locale: $localeStore, key: 'battles.show_less' })}
						{:else}
							{t({
								locale: $localeStore,
								key: 'battles.see_all',
								params: { count: sortedLeagueBattles.length }
							})}
						{/if}
					</button>
				{/if}
			{/if}
		</section>
	{/if}
</div>

{#if resolveBattleTarget !== null && resolveBattleOurSide !== null}
	<ResolveBattleModal
		battle={resolveBattleTarget}
		isOpen={true}
		onClose={() => {
			resolveBattleTarget = null;
			resolveBattleOurSide = null;
		}}
		onResolved={handleResolveDone}
		ourLeagueId={resolveBattleOurSide}
	/>
{/if}

<CreateBattleModal isOpen={createOpen} onClose={() => (createOpen = false)} />

<style lang="postcss">
	.battles-inbox {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		padding: 0 1.25rem 6rem;
	}

	/* ─── intro card ─────────────────────────────────────────── */
	/* ─── status / error ─────────────────────────────────────── */
	.battles-inbox-status,
	.battles-inbox-error {
		margin: 0;
		padding: 1rem;
		font-size: var(--t-13);
		border-radius: var(--r-12);
	}

	.battles-inbox-status {
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
	}

	.battles-inbox-error {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	/* ─── section ────────────────────────────────────────────── */
	.battles-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.battles-section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		margin-bottom: 0.1rem;
	}

	.battles-eyebrow {
		font-size: var(--t-10);
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
	}

	.battles-section-head-meta {
		font-size: var(--t-10);
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}

	.battles-section-head-cta {
		appearance: none;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.3rem 0.7rem;
		font: inherit;
		font-size: var(--t-11);
		font-weight: 700;
		color: var(--laurel);
		background: color-mix(in srgb, var(--laurel) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--laurel) 25%, var(--border-base));
		border-radius: var(--r-pill);
		cursor: pointer;
	}

	.battles-section-head-cta:hover {
		background: color-mix(in srgb, var(--laurel) 14%, transparent);
	}

	/* ─── grouped card ───────────────────────────────────────── */
	.battles-card {
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

	.battles-card:hover {
		border-color: color-mix(in srgb, var(--laurel) 38%, var(--border-base));
	}

	.battles-card.is-compact {
		padding: 0.75rem 0.9rem;
	}

	.battles-card.is-tournament {
		background:
			linear-gradient(180deg, color-mix(in srgb, #b49cff 10%, transparent), transparent 70%),
			var(--bg-surface);
		border-color: color-mix(in srgb, #b49cff 28%, var(--border-base));
	}

	.battles-card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.4rem;
	}

	.battles-card-tags {
		display: inline-flex;
		gap: 0.3rem;
	}

	.battles-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.15rem 0.4rem;
		font-family: var(--font-mono, var(--font-sans));
		font-size: var(--t-10);
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		border-radius: var(--r-4, 0.25rem);
	}

	.battles-tag.is-wc {
		background: color-mix(in srgb, #ff6b2a 14%, transparent);
		color: #ff8a4c;
	}

	.battles-tag.is-live {
		background: color-mix(in srgb, var(--no) 14%, transparent);
		color: var(--no);
	}

	.battles-tag.is-live::before {
		content: '';
		width: 5px;
		height: 5px;
		border-radius: var(--r-pill);
		background: var(--no);
	}

	.battles-tag.is-monthly {
		background: color-mix(in srgb, var(--laurel) 12%, transparent);
		color: var(--laurel);
	}

	.battles-tag.is-tournament-round {
		background: color-mix(in srgb, #b49cff 16%, transparent);
		color: #b49cff;
		border: 1px solid color-mix(in srgb, #b49cff 30%, transparent);
	}

	.battles-card-timer {
		font-size: var(--t-11);
		color: var(--text-muted);
	}

	.battles-card-title {
		margin: 0 0 0.25rem;
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: var(--t-15, 0.95rem);
		line-height: 1.25;
		letter-spacing: var(--tracking-snug);
		color: var(--text-base);
		text-wrap: balance;
	}

	.battles-card-title .serif-italic {
		color: var(--laurel);
		font-weight: 400;
	}

	.battles-card.is-tournament .battles-card-title .serif-italic {
		color: #b49cff;
	}

	.battles-card-meta {
		margin: 0 0 0.6rem;
		font-size: var(--t-11);
		color: var(--text-muted);
		letter-spacing: var(--tracking-wide);
	}

	/* ─── podium ─────────────────────────────────────────────── */
	.battles-podium {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.4rem;
		margin-bottom: 0.6rem;
	}

	.battles-pod-tile {
		padding: 0.55rem 0.3rem;
		text-align: center;
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-10, 0.6rem);
	}

	.battles-pod-tile.is-gold {
		background:
			linear-gradient(180deg, color-mix(in srgb, #e2b842 14%, transparent), transparent 70%),
			var(--bg-surface);
		border-color: color-mix(in srgb, #e2b842 40%, var(--border-base));
	}

	.battles-pod-tile.is-silver {
		background:
			linear-gradient(180deg, color-mix(in srgb, #c0c5cb 14%, transparent), transparent 70%),
			var(--bg-surface);
	}

	.battles-pod-tile.is-bronze {
		background:
			linear-gradient(180deg, color-mix(in srgb, #b57c52 14%, transparent), transparent 70%),
			var(--bg-surface);
	}

	.battles-pod-place {
		font-size: var(--t-14, 0.9rem);
		font-weight: 700;
		color: var(--text-muted);
	}

	.battles-pod-tile.is-gold .battles-pod-place {
		color: #e2b842;
	}

	.battles-pod-tile.is-silver .battles-pod-place {
		color: #c0c5cb;
	}

	.battles-pod-tile.is-bronze .battles-pod-place {
		color: #b57c52;
	}

	.battles-pod-name {
		margin-top: 0.18rem;
		font-size: var(--t-11);
		font-weight: 600;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.battles-pod-pct {
		margin-top: 0.1rem;
		font-size: var(--t-10);
		letter-spacing: var(--tracking-wide);
		color: var(--text-muted);
	}

	.battles-pod-tile.is-gold .battles-pod-pct {
		color: #e2b842;
		font-weight: 700;
	}

	/* ─── your-row inside grouped card ──────────────────────── */
	.battles-your-row {
		display: grid;
		grid-template-columns: 28px 1fr auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.6rem;
		background: color-mix(in srgb, var(--laurel) 6%, transparent);
		border: 1px solid color-mix(in srgb, var(--laurel) 18%, var(--border-base));
		border-radius: var(--r-10, 0.6rem);
	}

	.battles-your-row.is-tight {
		margin-top: 0.3rem;
	}

	.battles-your-row.is-tournament {
		background: color-mix(in srgb, #b49cff 8%, transparent);
		border-color: color-mix(in srgb, #b49cff 22%, var(--border-base));
	}

	.battles-your-em {
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

	.battles-your-em.is-tournament {
		color: #b49cff;
		background: color-mix(in srgb, #b49cff 16%, transparent);
	}

	.battles-your-text {
		font-size: var(--t-12);
		color: var(--text-base);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.battles-your-pct {
		font-size: var(--t-13);
		font-weight: 700;
		color: var(--laurel);
	}

	.battles-your-pct.is-tournament {
		color: #b49cff;
		font-size: var(--t-11);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	/* ─── see-all ───────────────────────────────────────────── */
	.battles-see-all {
		display: block;
		margin-top: 0.55rem;
		font-family: var(--font-mono, var(--font-sans));
		font-size: var(--t-10);
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--laurel);
	}

	.battles-card.is-tournament .battles-see-all {
		color: #b49cff;
	}

	.battles-see-all.is-button {
		appearance: none;
		width: 100%;
		padding: 0.75rem 0;
		text-align: center;
		background: transparent;
		border: 0;
		cursor: pointer;
	}

	/* ─── league-battle list ──────────────────────────────────── */
	.battles-empty {
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

	.battles-empty-lede {
		margin: 0;
		font-size: var(--t-15, 0.95rem);
		color: var(--laurel);
	}

	.battles-empty-sub {
		margin: 0;
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.battles-empty-cta {
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

	.battles-empty-cta:hover {
		background: color-mix(in srgb, var(--laurel) 14%, transparent);
	}

	.battles-list {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.battles-battle {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.75rem 0.9rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.battles-battle[data-state='in_flight'] {
		border-color: color-mix(in srgb, var(--laurel) 38%, var(--border-base));
	}

	.battles-battle-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.battles-sides {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		flex-wrap: wrap;
		min-width: 0;
	}

	/* Side chip — emblem-tinted: direct accentColor background at 13 %
	   opacity with a 30 % border, so the chip wears the school /
	   league tone instead of the generic laurel. */
	.battles-side {
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

	.battles-side:disabled {
		cursor: default;
		color: var(--text-muted);
		background: none;
		border-color: var(--border-base);
	}

	.battles-side[data-ours='true'] {
		font-weight: 700;
		color: var(--side-accent);
	}

	.battles-vs {
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.battles-state-link {
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

	.battles-state-link:hover {
		color: var(--text-base);
	}

	.battles-state {
		font-size: var(--t-10);
		letter-spacing: var(--tracking-allcaps);
		padding: 0.1rem 0.4rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-muted) 18%, transparent);
		color: var(--text-muted);
	}

	.battles-state[data-state='in_flight'] {
		background: color-mix(in srgb, var(--laurel) 22%, transparent);
		color: var(--laurel);
	}

	.battles-state[data-state='resolved'] {
		background: color-mix(in srgb, var(--text-muted) 12%, transparent);
		opacity: 0.7;
	}

	.battles-window {
		margin: 0;
		font-size: var(--t-11);
		color: var(--text-muted);
	}

	.battles-winner {
		margin: 0;
		font-size: var(--t-11);
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
	}

	.battles-score {
		margin-left: 0.25rem;
		color: var(--text-base);
	}

	.battles-action {
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

	.battles-action.is-primary {
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
	}

	.battles-action.is-primary:hover:not(:disabled) {
		background: color-mix(in srgb, var(--laurel) 88%, var(--text-base));
	}

	.battles-action.is-danger {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	.battles-action.is-danger:hover:not(:disabled) {
		background: color-mix(in srgb, var(--no-wash, var(--no)) 20%, transparent);
	}

	.battles-action:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
