<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import CreateLeagueModal from '$lib/components/leagues/CreateLeagueModal.svelte';
	import JoinLeagueModal from '$lib/components/leagues/JoinLeagueModal.svelte';
	import LeagueCtaCard from '$lib/components/leagues/LeagueCtaCard.svelte';
	import LeagueListCard from '$lib/components/leagues/LeagueListCard.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { authPrincipal } from '$lib/derived/user.derived';
	import type { LeagueWithRole } from '$lib/services/leagues.services';
	import { friendsListStore, refreshFriendRelations } from '$lib/stores/friends.store';
	import {
		leagueBattlesStore,
		leagueMembersStore,
		leaguesErrorStore,
		leaguesLoadedStore,
		myLeaguesStore,
		refreshMyLeagues
	} from '$lib/stores/leagues.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { profilesStore } from '$lib/stores/profiles.store';
	import type { BattleState } from '$lib/types/battle';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Social cohorts list page.
	 *
	 * Mounted inside the Arena tab container. Lists every league
	 * the caller is a member of via `listMyLeagues`, split into
	 * "founded" (the caller is the owner) and "joined" (everyone
	 * else). Each row carries a gradient logo tile, the league name
	 * + role chip, a member-count meta line, optional friend-overlap
	 * row when any of the viewer's friends are in the league, an
	 * optional latest-activity line derived from the league's most
	 * recent battle, and an inline copy-invite pill.
	 *
	 * The Create + Join entries live as trailing CTA cards — never
	 * as a top-of-list pill row.
	 */

	interface Props {
		// When true, hide the page's own appbar — the container is
		// expected to render one (e.g. the tabbed Arena parent).
		embedded?: boolean;
	}

	const { embedded = false }: Props = $props();

	interface LeagueRow extends LeagueWithRole {
		memberCount: number;
		members: string[];
		latestBattle: { state: BattleState; opponentId: string } | undefined;
	}

	let createOpen = $state(false);
	let joinOpen = $state(false);

	const selfPrincipal = $derived($authPrincipal);

	// Stale-while-revalidate: render whatever the shared leagues cache
	// holds and kick a background refresh on every mount. The skeleton
	// only shows on the cold load (before the first refresh resolves);
	// re-entering Arena → Leagues paints the cached list instantly.
	onMount(() => {
		void refreshMyLeagues();
		void refreshFriendRelations();
	});

	const loadState = $derived.by<'loading' | 'ready' | 'error'>(() => {
		if ($leaguesLoadedStore) {
			return 'ready';
		}

		return $leaguesErrorStore ? 'error' : 'loading';
	});

	// Build the per-league rows from the shared cache. Each row pulls its
	// roster + battles from the per-league maps the store hydrated; a
	// league still missing from the maps falls back to an empty roster.
	const rows = $derived.by<LeagueRow[]>(() =>
		$myLeaguesStore.map((m) => {
			const roster = $leagueMembersStore.get(m.league.id) ?? [];
			const members = roster.map((r) => r.member);
			const battleList = $leagueBattlesStore.get(m.league.id) ?? [];

			// Pick the most recently-touched battle we can identify. Battle
			// docs don't carry a timestamp on the wire schema today; we sort
			// by `kickoffMs` ascending (so newest upcoming kickoff is last)
			// and take the trailing non-resolved entry. Battles are typically
			// a small list per league so the cost is irrelevant.
			const sorted = [...battleList].sort((a, b) => a.kickoffMs - b.kickoffMs);
			const activeBattle = sorted.find((b) => b.state !== 'resolved') ?? sorted.at(-1);
			const opponentId = activeBattle
				? activeBattle.sideA === m.league.id
					? activeBattle.sideB
					: activeBattle.sideA
				: undefined;
			const latestBattle =
				activeBattle && opponentId ? { state: activeBattle.state, opponentId } : undefined;

			return {
				...m,
				memberCount: members.length,
				members,
				latestBattle
			} satisfies LeagueRow;
		})
	);

	const friendPrincipals = $derived.by(() => {
		const me = selfPrincipal;
		const set = new SvelteSet<string>();

		for (const relation of $friendsListStore) {
			const other = relation.participants.find((p) => p !== me);

			if (other) {
				set.add(other);
			}
		}

		return set;
	});

	const founded = $derived(rows.filter((r) => r.role === 'owner'));
	const joined = $derived(rows.filter((r) => r.role !== 'owner'));

	/**
	 * For each league, derive a friend-overlap summary using the
	 * `friendPrincipals` set + the prefetched profile cache. Falls
	 * back to a truncated principal text when no profile/nickname
	 * is cached yet.
	 */
	const friendOverlapFor = (
		row: LeagueRow
	): { handle: string; count: number; principals: string[] } | undefined => {
		const overlap = row.members.filter((m) => friendPrincipals.has(m));

		if (overlap.length === 0) {
			return;
		}

		const [first] = overlap;
		const profile = $profilesStore.get(first);
		const nickname = profile?.nickname?.trim();
		// Prefix the highlighted handle with `@` ("<b>@handle</b> +
		// N friends") for nicknamed members. Anonymous principals
		// stay un-prefixed.
		const handle = nickname && nickname.length > 0 ? `@${nickname}` : `${first.slice(0, 6)}…`;

		return { handle, count: overlap.length, principals: overlap };
	};

	/**
	 * Caller's 1-indexed position inside a league. The list endpoint
	 * sorts members join-ascending; we surface that ordinal as the
	 * "your rank" badge on the card. Undefined when the caller isn't
	 * found in the (still-hydrating) roster.
	 */
	const yourRankFor = (row: LeagueRow): number | undefined => {
		if (selfPrincipal === undefined) {
			return;
		}

		const idx = row.members.indexOf(selfPrincipal);

		return idx === -1 ? undefined : idx + 1;
	};

	/**
	 * Deterministic rank-trend for a league, seeded from its id so the
	 * arrow is stable across renders. Range ±3 (negative = climbed).
	 * Per-period rank deltas aren't exposed by the satellite yet, so
	 * this stands in until a ranking endpoint lands.
	 */
	const trendFor = (row: LeagueRow): number => {
		let seed = 0;

		for (const ch of row.league.id) {
			seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
		}

		return (seed % 7) - 3;
	};

	/**
	 * Translate the latest battle into a short "activity preview"
	 * line ("Live battle vs {opponent}", "Proposed battle vs
	 * {opponent}", …). Returns undefined when no battle exists.
	 *
	 * Opponent is resolved against the other leagues the caller
	 * is in first (cheap, no network); leagues outside the caller's
	 * membership fall through to a truncated id.
	 */
	const activityPreviewFor = (row: LeagueRow): string | undefined => {
		if (!row.latestBattle) {
			return;
		}

		const opponent = rows.find((r) => r.league.id === row.latestBattle?.opponentId);
		const opponentName = opponent?.league.name ?? `${row.latestBattle.opponentId.slice(0, 8)}…`;
		const stateLabel = STATE_LABELS[row.latestBattle.state];

		return t({
			locale: $localeStore,
			key: 'leagues.card.latest_battle',
			params: { state: stateLabel, opponent: opponentName }
		});
	};

	// Map of battle state → short display label. These mirror the
	// strings already shipped under `leagues.battle.state.*` but with
	// a sentence-case + trimmed form suited to inline copy.
	const STATE_LABELS: Record<BattleState, string> = {
		proposed: 'Proposed',
		accepted: 'Accepted',
		in_flight: 'Live',
		resolved: 'Resolved'
	};

	const openCreate = () => {
		createOpen = true;
	};

	const openJoin = () => {
		joinOpen = true;
	};

	const handleAfterAction = () => {
		createOpen = false;
		joinOpen = false;
		void refreshMyLeagues();
	};

	const handleCardClick = (leagueId: string) => {
		void goto(`${resolve(AppPath.Arena)}/leagues/${leagueId}`);
	};
</script>

<div class="leagues-page pb-24" class:embedded>
	{#if !embedded}
		<MobileAppBar align="left" title={t({ locale: $localeStore, key: 'leagues.title' })} />
	{/if}

	{#if loadState === 'loading'}
		<ul class="leagues-list" aria-busy="true">
			{#each Array.from({ length: 3 }) as _, i (i)}
				<li class="league-card-skeleton" aria-hidden="true"></li>
			{/each}
		</ul>
	{:else if loadState === 'error'}
		<p class="leagues-error" role="alert">
			{t({ locale: $localeStore, key: 'leagues.error.generic' })}
		</p>
	{:else if rows.length === 0}
		<section class="leagues-empty">
			<p class="leagues-empty-quote">
				{t({ locale: $localeStore, key: 'leagues.empty.quote' })}
			</p>
			<p class="leagues-empty-body">
				{t({ locale: $localeStore, key: 'leagues.empty.body' })}
			</p>
			<div class="leagues-empty-ctas">
				<button class="leagues-empty-cta is-primary" onclick={openCreate} type="button">
					{t({ locale: $localeStore, key: 'leagues.empty.cta_create' })}
				</button>
				<button class="leagues-empty-cta" onclick={openJoin} type="button">
					{t({ locale: $localeStore, key: 'leagues.empty.cta_join' })}
				</button>
			</div>
		</section>
	{:else}
		{#if founded.length > 0}
			<section class="leagues-section">
				<h2 class="leagues-eyebrow allcaps">
					{t({ locale: $localeStore, key: 'leagues.eyebrow.founded' })}
				</h2>
				<ul class="leagues-list">
					{#each founded as row (row.league.id)}
						<li>
							<LeagueListCard
								activityPreview={activityPreviewFor(row)}
								friendOverlap={friendOverlapFor(row)}
								league={row.league}
								memberCount={row.memberCount}
								onclick={() => handleCardClick(row.league.id)}
								role={row.role}
								trend={trendFor(row)}
								yourRank={yourRankFor(row)}
							/>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if joined.length > 0}
			<section class="leagues-section">
				<h2 class="leagues-eyebrow allcaps">
					{t({ locale: $localeStore, key: 'leagues.eyebrow.joined' })}
				</h2>
				<ul class="leagues-list">
					{#each joined as row (row.league.id)}
						<li>
							<LeagueListCard
								activityPreview={activityPreviewFor(row)}
								friendOverlap={friendOverlapFor(row)}
								league={row.league}
								memberCount={row.memberCount}
								onclick={() => handleCardClick(row.league.id)}
								role={row.role}
								trend={trendFor(row)}
								yourRank={yourRankFor(row)}
							/>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<ul class="leagues-list">
			<li>
				<LeagueCtaCard
					onclick={openCreate}
					sub={t({ locale: $localeStore, key: 'leagues.card.create_sub' })}
					title={t({ locale: $localeStore, key: 'leagues.card.create_title' })}
					variant="create"
				/>
			</li>
			<li>
				<LeagueCtaCard
					onclick={openJoin}
					sub={t({ locale: $localeStore, key: 'leagues.card.join_sub' })}
					title={t({ locale: $localeStore, key: 'leagues.card.join_title' })}
					variant="join"
				/>
			</li>
		</ul>

		<!-- "Friends are in" recommendations section is deferred:
		     the satellite has no public listing for leagues the
		     caller isn't already in, so we can't compute the
		     "friends here, you're not" overlap without scanning the
		     full collection. Tracked in the parity audit. -->
	{/if}
</div>

<CreateLeagueModal
	isOpen={createOpen}
	onClose={() => (createOpen = false)}
	onCreated={handleAfterAction}
/>

<JoinLeagueModal
	isOpen={joinOpen}
	onClose={() => (joinOpen = false)}
	onJoined={handleAfterAction}
/>

<style lang="postcss">
	.leagues-page {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.25rem 1.25rem 1.5rem;
	}

	/* Embedded in the Arena tab panel, the horizontal inset is already
	   supplied by the Arena page wrapper; drop ours so the content
	   aligns with the tab strip instead of sitting doubly indented. */
	.leagues-page.embedded {
		padding-left: 0;
		padding-right: 0;
	}

	.leagues-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.leagues-eyebrow {
		margin: 0;
		font-size: var(--t-10);
		font-weight: 600;
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
	}

	.leagues-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.league-card-skeleton {
		min-height: 4.4rem;
		background: color-mix(in srgb, var(--bg-surface) 75%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		opacity: 0.55;
		animation: leagues-pulse 1.4s ease-in-out infinite;
	}

	@keyframes leagues-pulse {
		0%,
		100% {
			opacity: 0.5;
		}

		50% {
			opacity: 0.75;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.league-card-skeleton {
			animation: none;
		}
	}

	.leagues-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		padding: 2.5rem 1.25rem;
		text-align: center;
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-16, var(--r-12));
	}

	.leagues-empty-quote {
		margin: 0;
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--t-20, 1.25rem);
		color: var(--color-primary);
	}

	.leagues-empty-body {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
		line-height: 1.5;
		max-width: 34ch;
	}

	.leagues-empty-ctas {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.45rem;
	}

	.leagues-empty-cta {
		appearance: none;
		padding: 0.55rem 0.95rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 700;
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 80%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici);
	}

	.leagues-empty-cta:hover {
		background: color-mix(in srgb, var(--bg-surface) 50%, transparent);
		border-color: var(--border-strong);
	}

	.leagues-empty-cta.is-primary {
		color: var(--text-on-accent, #fff);
		background: var(--color-primary);
		border-color: var(--color-primary);
	}

	.leagues-empty-cta.is-primary:hover {
		background: color-mix(in srgb, var(--color-primary) 88%, var(--text-base));
	}

	.leagues-error {
		margin: 0;
		padding: 1rem;
		font-size: var(--t-13);
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
		border-radius: var(--r-12);
	}
</style>
