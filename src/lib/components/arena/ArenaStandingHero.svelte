<script lang="ts" module>
	/**
	 * Percentile bracket for a 1-based `rank` within a ranked set of
	 * `total`. Absolute rank loses meaning at scale (`#247 of 2,480`
	 * reads as arithmetic; `Top 10%` reads instantly), and a percentile
	 * stays legible as the pool grows.
	 *
	 * Rounds UP to the next worse bracket so the better tiers feel
	 * earned, and returns `undefined` below the Top 50% tier — a
	 * demoralizing band gets no badge and the caller falls back to the
	 * absolute `#rank of total`.
	 */
	const BRACKET_LADDER = [0.1, 1, 5, 10, 25, 50] as const;

	export const pctBracket = ({
		rank,
		total
	}: {
		rank: number;
		total: number;
	}): number | undefined => {
		if (rank < 1 || total < 1) {
			return;
		}

		const pct = (rank / total) * 100;

		for (const tier of BRACKET_LADDER) {
			if (pct <= tier) {
				return tier;
			}
		}
	};
</script>

<script lang="ts">
	import type { PrincipalText } from '@junobuild/schema';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { AppPath } from '$lib/constants/routes.constants';
	import { lookupWorldsAffiliation } from '$lib/constants/worlds-affiliations.constants';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { listLeagueMembers, listMyLeagues } from '$lib/services/leagues.services';
	import {
		findOwnStanding,
		getLeagueStandings,
		getStandings
	} from '$lib/services/standings.services';
	import { listAffiliationStats } from '$lib/services/worlds.services';
	import { myAffiliationsStore, refreshMyAffiliations } from '$lib/stores/affiliations.store';
	import { friendsListStore, refreshFriendRelations } from '$lib/stores/friends.store';
	import { localeStore } from '$lib/stores/locale.store';
	import {
		affiliationMonthlyAccuracy,
		affiliationRankComparator
	} from '$lib/utils/affiliation-stats.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';

	/**
	 * Arena standing hero — one swipe-only standing that pages across the
	 * viewer's competitive scopes (Global → Friends → each League →
	 * Battle). A single ~76px rank figure reads at one consistent scale
	 * across every scope; tappable dots let the viewer jump between
	 * scopes and there is NO auto-advance — nothing rotates a stat out
	 * from under them.
	 *
	 * The Global scope leads with a percentile bracket (`Top 0.1%` /
	 * `Top 1%` / `Top 5%` / …) when the viewer is in the top half; below
	 * that it falls back to the absolute `#rank of total`. Movement reads as
	 * `▲ {n}` — a percentile-point delta (with a `%` suffix) for the
	 * Global scope, an absolute rank climb for the others.
	 *
	 * Every scope is sourced from real, already-cached data: the global
	 * + per-league + friends standings come from the clearing canister's
	 * ranked windows (the same source the Leaderboard surface uses), and
	 * the Battle scope ranks the viewer's university among the monthly
	 * roster. A scope is only added once its rank is known, so the hero
	 * never fabricates a position.
	 */

	interface Props {
		// Switch the embedding Arena hub to a named tab (used by the
		// Friends scope tap so it lands inside the hub).
		onSelectTab?: (tab: 'friends' | 'leagues' | 'battles') => void;
	}

	const { onSelectTab }: Props = $props();

	interface Scope {
		key: string;
		// Resolved scope label (already localized).
		label: string;
		// 1-based rank within the scope's ranked set.
		rank: number;
		// Total ranked set size.
		total: number;
		// Percentile bracket tier (e.g. 1 → "Top 1%"); undefined when the
		// scope shows an absolute rank.
		bracket: number | undefined;
		// Movement vs the prior window — positive climbs render "▲ {up}".
		up: number;
		// Append "%" to the movement figure (Global percentile scope).
		upSuffix: '%' | '';
		// Meta suffix line context (already localized).
		unit: string;
		onOpen: () => void;
	}

	let scopes = $state<Scope[]>([]);
	let idx = $state(0);
	let pointerDownX: number | null = null;

	const principal = $derived($authPrincipal);

	const goLeaderboard = () => {
		void goto(resolve(`${AppPath.Arena}/leaderboard`));
	};

	const goSchool = (id: string) => {
		void goto(`${resolve(AppPath.Arena)}/worlds/school/${id}`);
	};

	const unitThisWeek = $derived(t({ locale: $localeStore, key: 'arena.hero.unit_this_week' }));

	// Hydrate once the friend relations and affiliations have been
	// refreshed: `hydrate()` reads `$friendsListStore` / `$myAffiliationsStore`
	// synchronously, so kicking it off before those refreshes resolve can
	// permanently omit the Friends and Battle scopes on a cold load. The
	// `cancelled` flag drops a late resolution after the component is torn
	// down so we never write `scopes` on an unmounted instance.
	$effect(() => {
		let cancelled = false;

		void (async () => {
			await Promise.allSettled([refreshFriendRelations(), refreshMyAffiliations()]);

			if (cancelled) {
				return;
			}

			await hydrate(() => cancelled);
		})();

		return () => {
			cancelled = true;
		};
	});

	const hydrate = async (isCancelled: () => boolean): Promise<void> => {
		const owner = principal;

		if (owner === undefined) {
			return;
		}

		const next: Scope[] = [];

		// ── Global ──────────────────────────────────────────────────
		try {
			const global = await getStandings({ window: 'week' });
			const mine = findOwnStanding({ result: global, owner });

			if (mine !== undefined && global.total > 0) {
				const bracket = pctBracket({ rank: mine.rank, total: global.total });
				// Movement on the Global scope reads as a percentile-point
				// climb so it stays meaningful at any pool size: the prior
				// rank's percentile minus the current one (positive climbs).
				const priorPct =
					mine.priorRank !== undefined ? (mine.priorRank / global.total) * 100 : undefined;
				const nowPct = (mine.rank / global.total) * 100;
				const up = priorPct !== undefined ? Math.max(0, Math.round(priorPct - nowPct)) : 0;

				next.push({
					key: 'global',
					label: t({ locale: $localeStore, key: 'arena.hero.global' }),
					rank: mine.rank,
					total: global.total,
					bracket,
					up,
					upSuffix: '%',
					unit: unitThisWeek,
					onOpen: goLeaderboard
				});
			}
		} catch {
			// Skip the Global scope if the standings window fails to load.
		}

		// ── Friends ─────────────────────────────────────────────────
		try {
			const friendOwners = $friendsListStore
				.map((relation) => relation.participants.find((p) => p !== owner))
				.filter((p): p is PrincipalText => p !== undefined);

			if (friendOwners.length > 0) {
				const members = [...new Set([owner, ...friendOwners])];
				const friends = await getLeagueStandings({ window: 'week', members });
				const mine = findOwnStanding({ result: friends, owner });

				if (mine !== undefined && friends.total > 0) {
					next.push({
						key: 'friends',
						label: t({ locale: $localeStore, key: 'arena.hero.friends' }),
						rank: mine.rank,
						total: friends.total,
						bracket: undefined,
						up: mine.rankDelta !== undefined ? Math.max(0, mine.rankDelta) : 0,
						upSuffix: '',
						unit: unitThisWeek,
						onOpen: () => onSelectTab?.('friends')
					});
				}
			}
		} catch {
			// Skip the Friends scope on failure.
		}

		// ── Each League (best-ranked first) ─────────────────────────
		try {
			const myLeagues = await listMyLeagues();
			const leagueScopes: Scope[] = [];

			for (const { league } of myLeagues) {
				try {
					const roster = await listLeagueMembers({ leagueId: league.id });
					const members = roster.map((m) => m.member);
					const standings = await getLeagueStandings({ window: 'week', members });
					const mine = findOwnStanding({ result: standings, owner });

					if (mine !== undefined && standings.total > 0) {
						leagueScopes.push({
							key: `league-${league.id}`,
							label: league.name,
							rank: mine.rank,
							total: standings.total,
							bracket: undefined,
							up: mine.rankDelta !== undefined ? Math.max(0, mine.rankDelta) : 0,
							upSuffix: '',
							unit: unitThisWeek,
							onOpen: () => onSelectTab?.('leagues')
						});
					}
				} catch {
					// Skip a league whose standings can't be computed.
				}
			}

			leagueScopes.sort((a, b) => a.rank - b.rank);
			next.push(...leagueScopes);
		} catch {
			// Skip all league scopes on failure.
		}

		// ── Battle (university) ─────────────────────────────────────
		try {
			const uni = $myAffiliationsStore.university;

			if (uni !== undefined) {
				const stats = await listAffiliationStats({ kind: 'university' });
				const ranked = [...stats].sort(
					affiliationRankComparator({
						accuracyOf: affiliationMonthlyAccuracy,
						callsOf: (row) => row.totalCalls
					})
				);
				const rank = ranked.findIndex(
					(row) => row.affiliationIdentifier === uni.affiliationIdentifier
				);

				if (rank !== -1) {
					const option = lookupWorldsAffiliation({
						kind: 'university',
						id: uni.affiliationIdentifier
					});

					next.push({
						key: 'battle',
						label: t({
							locale: $localeStore,
							key: 'arena.hero.battle',
							params: { name: option?.name ?? uni.affiliationIdentifier }
						}),
						rank: rank + 1,
						total: ranked.length,
						bracket: undefined,
						up: 0,
						upSuffix: '',
						unit: t({ locale: $localeStore, key: 'arena.hero.unit_in_wc' }),
						onOpen: () => goSchool(uni.affiliationIdentifier)
					});
				}
			}
		} catch {
			// Skip the Battle scope on failure.
		}

		if (isCancelled()) {
			return;
		}

		scopes = next;

		if (idx >= scopes.length) {
			idx = 0;
		}
	};

	const current = $derived(scopes[idx]);

	// Bracket value rendered as the hero number (e.g. "1%"); "Top" rides
	// as a small prefix so a percentile reads at the same scale as an
	// absolute "#9" and the card height stays fixed across scopes.
	const bracketPrefix = $derived(t({ locale: $localeStore, key: 'arena.hero.top_prefix' }));

	const select = (n: number) => {
		if (scopes.length === 0) {
			return;
		}

		idx = (n + scopes.length) % scopes.length;
	};

	const onPointerDown = (event: PointerEvent) => {
		pointerDownX = event.clientX;
	};

	const onPointerUp = (event: PointerEvent) => {
		if (pointerDownX === null) {
			return;
		}

		const dx = event.clientX - pointerDownX;
		pointerDownX = null;

		// Treat a horizontal drag past the threshold as a scope page; a
		// small drag is a tap and opens the active scope's surface.
		if (Math.abs(dx) > 28) {
			select(idx + (dx < 0 ? 1 : -1));

			return;
		}

		current?.onOpen();
	};

	const onKeydown = (event: KeyboardEvent) => {
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			select(idx + 1);
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			select(idx - 1);
		} else if (event.key === 'Enter' || event.key === ' ') {
			// Only the hero itself opens the active scope — a focused dot
			// button has its own activation, so don't hijack its Enter/Space
			// when the keydown bubbles up from a nested control.
			if (event.target !== event.currentTarget) {
				return;
			}

			event.preventDefault();
			current?.onOpen();
		}
	};

	const dotLabel = (scope: Scope): string =>
		t({ locale: $localeStore, key: 'arena.hero.dot_aria', params: { scope: scope.label } });

	const heroAriaKey: MessageKey = 'arena.hero.aria';
</script>

{#if current !== undefined}
	<div class="ar-standing">
		<div
			class="ar-live"
			class:reduced-motion={prefersReducedMotion()}
			aria-label={t({
				locale: $localeStore,
				key: heroAriaKey,
				params: { scope: current.label }
			})}
			onkeydown={onKeydown}
			onpointerdown={onPointerDown}
			onpointerup={onPointerUp}
			role="button"
			tabindex="0"
		>
			<div class="ar-live-top">
				<span class="ar-live-ctx">{current.label}</span>
				{#if scopes.length > 1}
					<span class="ar-live-dots" role="tablist">
						{#each scopes as scope, i (scope.key)}
							<button
								class="ar-live-dot"
								class:is-on={i === idx}
								aria-label={dotLabel(scope)}
								aria-selected={i === idx}
								onclick={(event) => {
									event.stopPropagation();
									select(i);
								}}
								role="tab"
								type="button"
							></button>
						{/each}
					</span>
				{/if}
			</div>

			<div class="ar-live-body">
				{#if current.bracket !== undefined}
					<span class="num ar-live-rank is-bracket">
						<span class="ar-live-rank-pre">{bracketPrefix}</span>{current.bracket}%
					</span>
				{:else}
					<span class="num ar-live-rank">#{current.rank}</span>
				{/if}

				{#if current.up > 0}
					<span class="num ar-live-mv">▲ {current.up}{current.upSuffix}</span>
				{/if}

				<span class="ar-live-go" aria-hidden="true">→</span>
			</div>

			<div class="num ar-live-meta">
				{#if current.bracket !== undefined}
					{t({
						locale: $localeStore,
						key: 'arena.hero.meta_ranked',
						params: { rank: current.rank, total: current.total }
					})}
				{:else}
					{t({
						locale: $localeStore,
						key: 'arena.hero.meta_of',
						params: { total: current.total }
					})}
				{/if}
				· {current.unit}
			</div>
		</div>
	</div>
{/if}

<style lang="postcss">
	.ar-standing {
		padding: 1rem 0 0.85rem;
	}

	.ar-live {
		display: block;
		width: 100%;
		text-align: left;
		color: inherit;
		cursor: pointer;
		touch-action: pan-y;
		user-select: none;
		-webkit-user-select: none;
	}

	.ar-live:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--color-primary) 55%, transparent);
		outline-offset: 4px;
		border-radius: var(--r-8, 0.5rem);
	}

	.ar-live-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.ar-live-ctx {
		font-family: var(--font-mono);
		font-size: var(--t-10);
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ar-live-dots {
		display: inline-flex;
		gap: 5px;
		align-items: center;
		flex: none;
		margin-left: 10px;
	}

	.ar-live-dot {
		appearance: none;
		width: 5px;
		height: 5px;
		padding: 0;
		border: 0;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-muted) 50%, transparent);
		cursor: pointer;
		transition:
			width 220ms cubic-bezier(0.22, 1, 0.36, 1),
			background 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.ar-live-dot.is-on {
		width: 15px;
		background: var(--laurel);
	}

	.ar-live-dot:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--color-primary) 55%, transparent);
		outline-offset: 2px;
	}

	.reduced-motion .ar-live-dot {
		transition: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.ar-live-dot {
			transition: none;
		}
	}

	.ar-live-body {
		display: flex;
		align-items: flex-end;
		gap: 12px;
		margin-top: 8px;
		min-height: 64px;
	}

	.ar-live-rank {
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 76px;
		line-height: 0.84;
		letter-spacing: -0.05em;
		color: var(--text-base);
	}

	/* Bracket modifier — same hero size as an absolute rank; the "Top"
	   word is a small prefix so the percentage figure matches "#9" in
	   scale and the card height stays fixed across scopes. */
	.ar-live-rank.is-bracket {
		white-space: nowrap;
	}

	.ar-live-rank-pre {
		font-size: 22px;
		font-weight: 700;
		letter-spacing: 0.01em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-right: 9px;
	}

	.ar-live-mv {
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 600;
		color: var(--yes);
		white-space: nowrap;
	}

	.ar-live-meta {
		margin-top: 9px;
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.ar-live-go {
		margin-left: auto;
		align-self: center;
		font-family: var(--font-mono);
		font-size: 16px;
		color: color-mix(in srgb, var(--text-muted) 60%, transparent);
	}
</style>
