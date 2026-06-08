<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ScreenHeader from '$lib/components/layout/ScreenHeader.svelte';
	import BattlesIntroCard from '$lib/components/leagues/BattlesIntroCard.svelte';
	import CreateBoutModal from '$lib/components/leagues/CreateBoutModal.svelte';
	import WorldsBattleCard from '$lib/components/worlds/WorldsBattleCard.svelte';
	import { DAY_IN_MS } from '$lib/constants/app.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import {
		WORLDS_COUNTRIES,
		WORLDS_UNIVERSITIES
	} from '$lib/constants/worlds-affiliations.constants';
	import { daysToFinal } from '$lib/derived/featured-event.derived';
	import { listMyLeagues } from '$lib/services/leagues.services';
	import { getCurrentTournament } from '$lib/services/tournament.services';
	import { listAffiliationStats } from '$lib/services/worlds.services';
	import { myAffiliationsStore, refreshMyAffiliations } from '$lib/stores/affiliations.store';
	import { localeStore } from '$lib/stores/locale.store';
	import type { AffiliationStatsDoc } from '$lib/types/affiliation-stats';
	import {
		TOURNAMENT_ROUNDS,
		type TournamentDoc,
		type TournamentMatchDoc,
		type TournamentRound
	} from '$lib/types/tournament';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { goBack } from '$lib/utils/nav.utils';
	import { BATTLES_INTRO_SEEN_KEY } from '$lib/utils/onboarding-flags.utils';

	/**
	 * Battles inbox — institutional + tournament surfaces only.
	 *
	 * League-vs-league battles live exclusively under the Leagues
	 * surface (the Leagues tab + each league's detail page), so this
	 * inbox carries only the cross-app, non-league battles. The page
	 * is composed of surface-grouped sections (grouped by **surface**,
	 * never by battle state):
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
	 * A footer link routes to the Leagues tab, where league battles are
	 * proposed and managed per league.
	 */

	interface Props {
		// When true, hide the page's own appbar — the container is
		// expected to render one (e.g. the tabbed Arena parent).
		embedded?: boolean;
	}

	const { embedded = false }: Props = $props();

	// ─── Battles inbox state ──────────────────────────────────────────
	let loadState: 'loading' | 'ready' | 'error' = $state('loading');
	let errorMessage: string | null = $state(null);
	// League ids the caller belongs to — feeds the tournament card's
	// "your league is in" row. League battles themselves live under the
	// Leagues surface, so we keep only the ids, not the battle list.
	let myLeagueIds: string[] = $state([]);

	// ─── Worlds podium state ────────────────────────────────────────
	// Caller's affiliations come from the shared cache (stale-while-
	// revalidate); the public school/country stats stay a per-mount fetch.
	const myUni = $derived($myAffiliationsStore.university);
	const myCountry = $derived($myAffiliationsStore.country);
	let uniStats = $state<AffiliationStatsDoc[]>([]);
	let countryStats = $state<AffiliationStatsDoc[]>([]);

	// ─── Tournament state ───────────────────────────────────────────
	let tournament = $state<TournamentDoc | null>(null);
	let matches = $state<TournamentMatchDoc[]>([]);

	// ─── Intro card dismissal ───────────────────────────────────────
	// Persisted via the `BATTLES_INTRO_SEEN_KEY` localStorage flag. Future
	// migration to cross-device preferences is deferred — adding a new field
	// to the satellite preferences schema requires a Candid + Rust binding
	// regen scoped outside this work.
	let battlesIntroSeen = $state(false);

	// Create-a-battle wizard — opened from the intro CTA and the slim
	// "Start a battle" row.
	let createBoutOpen = $state(false);

	const load = async () => {
		try {
			const [mineList, schools, countries, tour] = await Promise.all([
				listMyLeagues(),
				listAffiliationStats({ kind: 'university' }),
				listAffiliationStats({ kind: 'country' }),
				getCurrentTournament()
			]);
			myLeagueIds = mineList.map((m) => m.league.id);
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
				battlesIntroSeen = localStorage.getItem(BATTLES_INTRO_SEEN_KEY) === '1';
			} catch {
				// Storage unavailable — keep the intro visible.
			}
		}

		void refreshMyAffiliations();
		void load();
	});

	const dismissIntro = () => {
		battlesIntroSeen = true;

		if (browser) {
			try {
				localStorage.setItem(BATTLES_INTRO_SEEN_KEY, '1');
			} catch {
				// Storage unavailable — dismissal won't survive a reload.
			}
		}
	};

	// League-vs-league battles live under the Leagues surface; the
	// footer link routes there to manage them per league.
	const goToLeagues = () => {
		void goto(`${resolve(AppPath.Arena)}/leagues`);
	};

	// Open the create-a-battle wizard (pick league → opponent →
	// duration → send). Reachable from the first-visit intro CTA and
	// the persistent slim "Start a battle" row.
	const openCreateBout = () => {
		createBoutOpen = true;
	};

	// ─── Worlds roster helpers ──────────────────────────────────────
	// The single Worlds battle card owns its own scope ranking — it
	// receives the full roster `stats` and re-sorts per the active
	// scope — so the parent only supplies the roster, the viewer's
	// affiliation, the total size, and the two countdowns.
	const universityCount = WORLDS_UNIVERSITIES.length;
	const countryCount = WORLDS_COUNTRIES.length;

	const eventDaysLeft = $derived($daysToFinal);

	// Days left in the current calendar month — the Season scope's
	// countdown. The season always runs to the end of the active month.
	const monthDaysLeft = $derived.by((): number => {
		const now = new Date();
		const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
		const delta = end - now.getTime();

		return delta <= 0 ? 0 : Math.ceil(delta / DAY_IN_MS);
	});

	// Open a roster's detail surface on the scope the viewer was looking
	// at — the detail page reads `?scope=wc|month` to land on the same
	// ranking.
	const goWorldsUniversities = (scope: 'wc' | 'month') => {
		const suffix = scope === 'month' ? '?scope=month' : '';
		void goto(`${resolve(AppPath.Arena)}/worlds/schools${suffix}`);
	};

	const goWorldsCountries = (scope: 'wc' | 'month') => {
		const suffix = scope === 'month' ? '?scope=month' : '';
		void goto(`${resolve(AppPath.Arena)}/worlds/countries${suffix}`);
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

	const myLeagueInTournament = $derived.by((): { rank: number } | null => {
		if (tournament === null) {
			return null;
		}

		const myInSeeded = tournament.seededLeagueIds.findIndex((id) => myLeagueIds.includes(id));

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
</script>

<div class="battles-inbox" class:embedded>
	{#if !embedded}
		<ScreenHeader
			back={{
				label: t({ locale: $localeStore, key: 'leagues.battles_inbox.back' }),
				onBack: () => goBack(resolve(AppPath.Arena))
			}}
			title={t({ locale: $localeStore, key: 'leagues.battles_inbox.title' })}
		/>
	{/if}

	{#if !battlesIntroSeen}
		<BattlesIntroCard onDismiss={dismissIntro} onStartBattle={openCreateBout} />
	{:else}
		<!-- Once the intro is dismissed, the create action persists as a
		     slim always-available row so starting a battle is never
		     buried. -->
		<button class="battles-start-row" onclick={openCreateBout} type="button">
			<span class="battles-start-row-label">
				{t({ locale: $localeStore, key: 'battles.start_row.label' })}
			</span>
			<span class="num allcaps battles-start-row-cta">
				{t({ locale: $localeStore, key: 'battles.start_row.cta' })} →
			</span>
		</button>
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
		<WorldsBattleCard
			kind="university"
			{monthDaysLeft}
			myAffiliationIdentifier={myUni?.affiliationIdentifier}
			onOpen={goWorldsUniversities}
			stats={uniStats}
			total={universityCount}
			wcDaysLeft={eventDaysLeft}
		/>

		<!-- ─── Worlds Countries ────────────────────────────────── -->
		<WorldsBattleCard
			divided
			kind="country"
			{monthDaysLeft}
			myAffiliationIdentifier={myCountry?.affiliationIdentifier}
			onOpen={goWorldsCountries}
			stats={countryStats}
			total={countryCount}
			wcDaysLeft={eventDaysLeft}
		/>

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

		<!-- ─── League battles live under Leagues ─────────────────── -->
		<button class="battles-leagues-link" onclick={goToLeagues} type="button">
			<span class="battles-leagues-link-body">
				<span class="serif-italic battles-leagues-link-lede">
					{t({ locale: $localeStore, key: 'battles.leagues_link.lede' })}
				</span>
				<span class="battles-leagues-link-sub">
					{t({ locale: $localeStore, key: 'battles.leagues_link.sub' })}
				</span>
			</span>
			<span class="battles-leagues-link-cta allcaps">
				{t({ locale: $localeStore, key: 'battles.leagues_link.cta' })} →
			</span>
		</button>
	{/if}
</div>

<CreateBoutModal isOpen={createBoutOpen} onClose={() => (createBoutOpen = false)} />

<style lang="postcss">
	.battles-inbox {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		padding: 0 1.25rem 6rem;
	}

	/* Embedded in the Arena tab panel, the horizontal inset is already
	   supplied by the Arena page wrapper; drop ours so the content
	   aligns with the tab strip instead of sitting doubly indented. */
	.battles-inbox.embedded {
		padding-left: 0;
		padding-right: 0;
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

	/* ─── slim "start a battle" row (post-dismissal) ─────────── */
	.battles-start-row {
		appearance: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		width: 100%;
		margin: 0.25rem 0;
		padding: 0.7rem 1rem;
		font: inherit;
		text-align: left;
		color: var(--text-base);
		background: transparent;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		cursor: pointer;
		transition: border-color 140ms ease;
	}

	.battles-start-row:hover {
		border-color: color-mix(in srgb, var(--laurel) 30%, var(--border-base));
	}

	.battles-start-row-label {
		font-size: var(--t-13);
		font-weight: 600;
	}

	.battles-start-row-cta {
		flex-shrink: 0;
		font-size: var(--t-10);
		letter-spacing: 0.14em;
		color: var(--text-muted);
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
		font-family: var(--font-mono);
		font-size: var(--t-10);
		letter-spacing: 0.16em;
		color: var(--text-muted);
	}

	.battles-section-head-meta {
		font-size: var(--t-10);
		letter-spacing: 0.08em;
		color: var(--text-muted);
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
		animation: battles-live-pulse 1.6s infinite;
	}

	@keyframes battles-live-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.battles-tag.is-live::before {
			animation: none;
		}
	}

	.battles-tag.is-tournament-round {
		background: color-mix(in srgb, #b49cff 16%, transparent);
		color: #b49cff;
		border: 1px solid color-mix(in srgb, #b49cff 30%, transparent);
	}

	.battles-card-timer {
		font-size: var(--t-10);
		color: var(--text-muted);
	}

	.battles-card-title {
		margin: 0 0 0.25rem;
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: 1.0625rem;
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
		font-family: var(--font-mono);
		font-size: var(--t-10);
		color: var(--text-muted);
		letter-spacing: var(--tracking-wide);
	}

	/* ─── your-row inside grouped card ──────────────────────── */
	.battles-your-row {
		display: grid;
		grid-template-columns: 24px 1fr auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.6rem;
		background: color-mix(in srgb, var(--laurel) 6%, transparent);
		border: 1px solid color-mix(in srgb, var(--laurel) 18%, var(--border-base));
		border-radius: var(--r-10, 0.6rem);
	}

	.battles-your-row.is-tournament {
		background: color-mix(in srgb, #b49cff 8%, transparent);
		border-color: color-mix(in srgb, #b49cff 22%, var(--border-base));
	}

	.battles-your-em {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
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
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--laurel);
	}

	.battles-card.is-tournament .battles-see-all {
		color: #b49cff;
	}

	/* ─── league battles → Leagues footer link ────────────────── */
	.battles-leagues-link {
		appearance: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		width: 100%;
		padding: 0.9rem 1rem;
		font: inherit;
		text-align: left;
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px dashed var(--border-base);
		border-radius: var(--r-12);
		cursor: pointer;
		transition:
			background 140ms ease,
			border-color 140ms ease;
	}

	.battles-leagues-link:hover {
		background: color-mix(in srgb, var(--laurel) 6%, transparent);
		border-color: color-mix(in srgb, var(--laurel) 30%, var(--border-base));
	}

	.battles-leagues-link-body {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.battles-leagues-link-lede {
		font-size: var(--t-14, 0.9rem);
		color: var(--laurel);
	}

	.battles-leagues-link-sub {
		font-size: var(--t-12);
		line-height: 1.4;
		color: var(--text-muted);
	}

	.battles-leagues-link-cta {
		flex-shrink: 0;
		font-family: var(--font-mono, var(--font-sans));
		font-size: var(--t-10);
		font-weight: 700;
		letter-spacing: 0.14em;
		color: var(--laurel);
	}
</style>
