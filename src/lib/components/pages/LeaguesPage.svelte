<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { functions } from '$declarations/satellite/satellite.api';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import CreateLeagueModal from '$lib/components/leagues/CreateLeagueModal.svelte';
	import JoinLeagueModal from '$lib/components/leagues/JoinLeagueModal.svelte';
	import LeagueCtaCard from '$lib/components/leagues/LeagueCtaCard.svelte';
	import LeagueListCard from '$lib/components/leagues/LeagueListCard.svelte';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import {
		listLeagueBouts,
		listMyLeagues,
		type LeagueWithRole
	} from '$lib/services/leagues.services';
	import { loadProfilesByPrincipals } from '$lib/services/profile.services';
	import { friendsListStore, refreshFriendRelations } from '$lib/stores/friends.store';
	import { leaguesCreateIntent } from '$lib/stores/leagues-ui.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { profilesStore } from '$lib/stores/profiles.store';
	import type { BoutState } from '$lib/types/bout';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Social cohorts list page.
	 *
	 * Mounted inside the Social tab container. Lists every league
	 * the caller is a member of via `listMyLeagues`, split into
	 * "founded" (the caller is the owner) and "joined" (everyone
	 * else). Each row carries a gradient logo tile, the league name
	 * + role chip, a member-count meta line, optional friend-overlap
	 * row when any of the viewer's friends are in the league, an
	 * optional latest-activity line derived from the league's most
	 * recent bout, and an inline copy-invite pill.
	 *
	 * The Create + Join entries live as trailing CTA cards (and a
	 * compact appbar `+` from the Social shell) — never as a
	 * top-of-list pill row.
	 */

	interface Props {
		// When true, hide the page's own appbar — the container is
		// expected to render one (e.g. the tabbed Social parent).
		embedded?: boolean;
	}

	const { embedded = false }: Props = $props();

	interface LeagueRow extends LeagueWithRole {
		memberCount: number;
		members: string[];
		latestBout: { state: BoutState; opponentId: string } | undefined;
	}

	let rows = $state<LeagueRow[]>([]);
	let loadState = $state<'loading' | 'ready' | 'error'>('loading');
	let errorMessage = $state<string | null>(null);
	let createOpen = $state(false);
	let joinOpen = $state(false);
	let selfPrincipal = $state<string | undefined>(undefined);

	/**
	 * Build the per-league rows. Each league's member list + bouts
	 * are fetched in parallel; failures fall back to an empty roster
	 * + no activity so a single flaky league doesn't tank the list.
	 */
	const hydrateRows = async (memberships: LeagueWithRole[]): Promise<LeagueRow[]> => {
		if (memberships.length === 0) {
			return [];
		}

		const fetched = await Promise.all(
			memberships.map(async (m) => {
				try {
					const [memberRes, boutList] = await Promise.all([
						functions.listLeagueMembers({ leagueId: m.league.id }),
						listLeagueBouts({ leagueId: m.league.id })
					]);

					const members = memberRes.items.map((row) => row.member);
					// Pick the most recently-touched bout we can identify.
					// Bout docs don't carry a timestamp on the wire schema
					// today; we sort by `kickoffMs` ascending (so newest
					// upcoming kickoff is last) and take the trailing
					// non-resolved entry. Bouts are typically a small list
					// per league so the cost is irrelevant.
					const sorted = [...boutList].sort((a, b) => a.kickoffMs - b.kickoffMs);
					const activeBout = sorted.find((b) => b.state !== 'resolved') ?? sorted.at(-1);
					const opponentId = activeBout
						? activeBout.sideA === m.league.id
							? activeBout.sideB
							: activeBout.sideA
						: undefined;
					const latestBout =
						activeBout && opponentId ? { state: activeBout.state, opponentId } : undefined;

					return {
						...m,
						memberCount: members.length,
						members,
						latestBout
					} satisfies LeagueRow;
				} catch (err) {
					console.warn('LeaguesPage: hydrate failed for league', m.league.id, err);

					return {
						...m,
						memberCount: 0,
						members: [],
						latestBout: undefined
					} satisfies LeagueRow;
				}
			})
		);

		// Prefetch profiles for every league member we'll be able to
		// name in the friend-overlap row.
		const allMembers = new SvelteSet<string>();

		for (const row of fetched) {
			for (const member of row.members) {
				allMembers.add(member);
			}
		}

		void loadProfilesByPrincipals({ principals: [...allMembers] });

		return fetched;
	};

	const refresh = async () => {
		try {
			const identity = await safeGetIdentityOnce();
			selfPrincipal = identity.getPrincipal().toText();

			// Friends list and memberships in parallel.
			const [memberships] = await Promise.all([listMyLeagues(), refreshFriendRelations()]);

			rows = await hydrateRows(memberships);
			loadState = 'ready';
		} catch (err) {
			console.error('LeaguesPage: refresh failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
			loadState = 'error';
		}
	};

	onMount(refresh);

	// Listen for the parent Social appbar's "+" create-league button:
	// when the intent flips to `true`, open our modal and reset the
	// intent so a navigation away/back doesn't re-trigger.
	$effect(() => {
		if ($leaguesCreateIntent) {
			createOpen = true;
			leaguesCreateIntent.set(false);
		}
	});

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
	const friendOverlapFor = (row: LeagueRow): { handle: string; count: number } | undefined => {
		const overlap = row.members.filter((m) => friendPrincipals.has(m));

		if (overlap.length === 0) {
			return;
		}

		const [first] = overlap;
		const profile = $profilesStore.get(first);
		const nickname = profile?.nickname?.trim();
		const handle = nickname && nickname.length > 0 ? nickname : `${first.slice(0, 6)}…`;

		return { handle, count: overlap.length };
	};

	/**
	 * Translate the latest bout into a short "activity preview"
	 * line ("Live bout vs {opponent}", "Proposed bout vs
	 * {opponent}", …). Returns undefined when no bout exists.
	 *
	 * Opponent is resolved against the other leagues the caller
	 * is in first (cheap, no network); leagues outside the caller's
	 * membership fall through to a truncated id.
	 */
	const activityPreviewFor = (row: LeagueRow): string | undefined => {
		if (!row.latestBout) {
			return;
		}

		const opponent = rows.find((r) => r.league.id === row.latestBout?.opponentId);
		const opponentName = opponent?.league.name ?? `${row.latestBout.opponentId.slice(0, 8)}…`;
		const stateLabel = STATE_LABELS[row.latestBout.state];

		return t({
			locale: $localeStore,
			key: 'leagues.card.latest_bout',
			params: { state: stateLabel, opponent: opponentName }
		});
	};

	// Map of bout state → short display label. These mirror the
	// strings already shipped under `leagues.bout.state.*` but with
	// a sentence-case + trimmed form suited to inline copy.
	const STATE_LABELS: Record<BoutState, string> = {
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
		void refresh();
	};

	const handleCardClick = (leagueId: string) => {
		void goto(`/social/leagues/${leagueId}`);
	};
</script>

<div class="leagues-page space-y-5 pb-24">
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
			{errorMessage ?? t({ locale: $localeStore, key: 'leagues.error.generic' })}
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
		padding: 0 1rem;
	}

	.leagues-section {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.leagues-eyebrow {
		margin: 0;
		font-size: var(--t-10, 0.6rem);
		font-weight: 600;
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
	}

	.leagues-list {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
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
