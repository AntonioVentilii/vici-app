<script lang="ts">
	import type { Doc } from '@junobuild/core';
	import { ArrowDown, ArrowUp, Minus, UserMinus, UserPlus } from '@lucide/svelte/icons';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { resolve } from '$app/paths';
	import ScreenHeader from '$lib/components/layout/ScreenHeader.svelte';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import { USD_DECIMALS } from '$lib/constants/app.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { globalStandingsRows, type StandingsRow } from '$lib/derived/standings.derived';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { loadProfilesByPrincipals } from '$lib/services/profile.services';
	import {
		cancelFriendRequest,
		sendFriendRequest,
		unfriendUser
	} from '$lib/services/relation.services';
	import { loadGlobalStandings } from '$lib/services/standings.services';
	import {
		friendsListStore,
		refreshFriendRelations,
		sentFriendRequestsStore
	} from '$lib/stores/friends.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { Relation } from '$lib/types/relation';
	import type { StandingsWindow } from '$lib/types/standings';
	import { decimalFixedValueToNumber, shortenPrincipal } from '$lib/utils/format.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { goBack } from '$lib/utils/nav.utils';
	import { formatWholeVxpMagnitude } from '$lib/utils/playground-display.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';

	/**
	 * Global standings.
	 *
	 * Three windows (`This week` / `This month` / `All time`) each read their
	 * own slice of the clearing canister's `list_leaderboard` ranking (by net
	 * realized P&L over a fixed calendar window). Switching a window lazily
	 * loads + caches that slice, so a revisit renders instantly while a refresh
	 * runs in the background.
	 *
	 * Layout is a single column:
	 *  - chip-style window tabs at the top
	 *  - 3-tile podium row (top-3, #1 gets the gold halo + tinted bg)
	 *  - flat list of rest rows (rank + ↑/↓ delta, avatar, handle + the
	 *    ranking VXP + streak, accuracy on the right — coloured `--yes` once
	 *    accuracy ≥ 78%)
	 *
	 * Rank, the prior-window delta, and accuracy are authoritative from the
	 * clearing canister; handle / avatar / streak are overlaid from the shared
	 * profile cache (the viewer's own row from their live profile). The
	 * viewer's own row carries an accent border + tinted bg and is never
	 * tappable; every other row / podium tile opens a mini-profile bottom sheet
	 * with an add- or remove-friend action that routes through the same
	 * `relation.services` the Friends tab uses.
	 */

	const windows: { id: StandingsWindow; labelKey: MessageKey }[] = [
		{ id: 'week', labelKey: 'leaderboard.scope.week' },
		{ id: 'month', labelKey: 'leaderboard.scope.month' },
		{ id: 'all', labelKey: 'leaderboard.scope.all' }
	];

	let activeWindow = $state<StandingsWindow>('week');
	const currentUser = $derived($authPrincipal);

	// Only the active window's joined rows are computed. `globalStandingsRows`
	// re-maps its whole window on every `profilesStore` trickle, so instantiating
	// all three at once would keep re-mapping two windows that aren't on screen.
	// The standings store caches per-window, so switching tabs re-subscribes to
	// the cached slice. `undefined` until the active window's slice has loaded,
	// distinct from a loaded-but-empty window (`[]`).
	const rowsStore = $derived(globalStandingsRows(activeWindow));
	const rows = $derived<StandingsRow[] | undefined>($rowsStore);

	const loading = $derived(rows === undefined);
	const rankedRows = $derived(rows ?? []);

	const podium = $derived(rankedRows.slice(0, 3));
	const rest = $derived(rankedRows.slice(3));

	// Hydrate each window on first view. The store caches per-window, so a
	// repeat visit short-circuits the fetch and re-renders the cached slice.
	$effect(() => {
		const window = activeWindow;

		if (rows === undefined) {
			void loadGlobalStandings({ window }).catch((err: unknown) => {
				console.error(err);
			});
		}
	});

	// Hydrate the shared profile cache for the rows this surface actually
	// paints — handle / avatar / streak overlay onto the standing reactively as
	// profiles land. `loadGlobalStandings` no longer hydrates (the dash shares
	// its cached slice but only needs the viewer's own rank), so the Leaderboard
	// owns this. `loadProfilesByPrincipals` dedupes against the cache, so the
	// re-run this triggers once profiles arrive is a no-op.
	//
	// The viewer's own row is excluded: `globalStandingsRows` already overlays
	// the self row from the live `userStore.profile`, so hydrating it would only
	// add a redundant `getProfile` on every visit / window switch.
	$effect(() => {
		const owners = rankedRows.filter((row) => !row.isSelf).map((row) => row.owner);

		if (owners.length > 0) {
			void loadProfilesByPrincipals({ principals: owners });
		}
	});

	const handleOf = (row: StandingsRow): string =>
		row.nickname && row.nickname.length > 0 ? row.nickname : shortenPrincipal(row.owner);

	// The VXP the ranking is built on: net realized P&L over the window. The
	// rows are ordered by this figure (descending), so surfacing it makes the
	// order legible — accuracy stays the headline stat but no longer reads as
	// the rank driver. `realizedPnl` is a signed `USD_DECIMALS` fixed-point
	// value (the realized-cashflow convention), decoded via
	// `decimalFixedValueToNumber`; the magnitude is rendered as whole VXP and
	// prefixed with the swing sign (`+` / `−`), zero shown unsigned.
	const rankingVxp = (entry: StandingsRow['entry']): string => {
		const value = decimalFixedValueToNumber({ value: entry.realizedPnl, decimals: USD_DECIMALS });
		const sign = value > 0 ? '+' : value < 0 ? '−' : '';

		return `${sign}${formatWholeVxpMagnitude(value)}`;
	};

	const rankOf = (owner: string): number =>
		rankedRows.find((row) => row.owner === owner)?.entry.rank ?? 0;

	// ── Friend state ────────────────────────────────────────────────
	const friendOwners = $derived(
		new Set(
			$friendsListStore.flatMap((relation) =>
				relation.participants.filter((p) => p !== currentUser)
			)
		)
	);

	const isFriend = (owner: string): boolean => friendOwners.has(owner);

	const pendingSentDoc = (owner: string): Doc<Relation> | undefined =>
		$sentFriendRequestsStore.find((doc) => doc.data.participants.includes(owner));

	onMount(() => {
		// Hydrate the shared social graph so `isFriend` is accurate on first
		// paint. The store is stale-while-revalidate.
		void refreshFriendRelations();
	});

	// ── Mini-profile bottom sheet ───────────────────────────────────
	let openRow = $state<StandingsRow | undefined>(undefined);
	let mutatingOwner = $state<string | undefined>(undefined);

	const openSheet = (row: StandingsRow) => {
		// The viewer's own row is informational — there's nothing to add.
		if (row.isSelf) {
			return;
		}

		openRow = row;
	};

	const closeSheet = () => {
		openRow = undefined;
	};

	const handleToggleFriend = async () => {
		if (!openRow || !currentUser) {
			return;
		}

		const target = openRow.owner;
		mutatingOwner = target;

		// Determine which of the three states we are in at call time.
		const friendDoc = pendingSentDoc(target);
		const accepted = isFriend(target);
		const isPending = !accepted && friendDoc !== undefined;

		let errorKey: MessageKey = 'arena.friends.error.send_failed';

		try {
			if (accepted) {
				errorKey = 'arena.friends.error.unfriend_failed';
				await unfriendUser({ target, sender: currentUser });
			} else if (isPending) {
				errorKey = 'arena.friends.error.cancel_failed';
				await cancelFriendRequest({ currentRelation: friendDoc });
			} else {
				await sendFriendRequest({ target, sender: currentUser });
			}

			await refreshFriendRelations();
			openRow = undefined;
		} catch (err: unknown) {
			console.error(err);
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'leaderboard.title' }),
				message: t({ locale: $localeStore, key: errorKey }),
				type: 'error'
			});
		} finally {
			mutatingOwner = undefined;
		}
	};
</script>

<!-- ↑/↓ rank-delta pill. Positive delta = climbed (better rank), negative =
     dropped, 0 = held. `undefined` (newcomer / no prior window) shows nothing. -->
{#snippet rankDelta(delta: number | undefined)}
	{#if delta !== undefined && delta > 0}
		<span class="lb-delta lb-delta-up num">
			<ArrowUp aria-hidden="true" size={11} strokeWidth={2.4} />{delta}
		</span>
	{:else if delta !== undefined && delta < 0}
		<span class="lb-delta lb-delta-down num">
			<ArrowDown aria-hidden="true" size={11} strokeWidth={2.4} />{Math.abs(delta)}
		</span>
	{:else if delta === 0}
		<span class="lb-delta lb-delta-flat">
			<Minus aria-hidden="true" size={11} strokeWidth={2.4} />
		</span>
	{/if}
{/snippet}

<div class="leaderboard-page">
	<ScreenHeader
		back={{
			label: t({ locale: $localeStore, key: 'leaderboard.back' }),
			onBack: () => goBack(resolve(AppPath.Arena))
		}}
		title={t({ locale: $localeStore, key: 'leaderboard.title' })}
	/>

	<!-- Window chips — `This week / This month / All time`. -->
	<div class="leaderboard-scopes" role="tablist">
		{#each windows as window (window.id)}
			<button
				class="leaderboard-scope"
				class:is-active={activeWindow === window.id}
				aria-selected={activeWindow === window.id}
				onclick={() => (activeWindow = window.id)}
				role="tab"
				type="button"
			>
				{t({ locale: $localeStore, key: window.labelKey })}
			</button>
		{/each}
	</div>

	{#if loading}
		<div class="leaderboard-loading">
			<div class="leaderboard-spinner"></div>
			<p class="allcaps">{t({ locale: $localeStore, key: 'leaderboard.loading' })}</p>
		</div>
	{:else if rankedRows.length === 0}
		<div class="leaderboard-empty">
			<p class="allcaps">{t({ locale: $localeStore, key: 'leaderboard.empty' })}</p>
			<p class="leaderboard-empty-sub">
				{t({ locale: $localeStore, key: 'leaderboard.empty_sub' })}
			</p>
		</div>
	{:else}
		<!-- 3-tile podium row. #1 gets the gold halo + tinted bg; #2 / #3 stay
		     on the neutral surface. Every tile but the viewer's own is a real
		     button that opens the mini-profile sheet. -->
		<div class="leaderboard-podium">
			{#each podium as row, i (row.owner)}
				<button
					class="leaderboard-podium-tile"
					class:is-first={i === 0}
					class:is-you={row.isSelf}
					aria-label={row.isSelf
						? undefined
						: t({
								locale: $localeStore,
								key: 'leaderboard.open_profile_aria',
								params: { name: handleOf(row) }
							})}
					disabled={row.isSelf}
					onclick={() => openSheet(row)}
					type="button"
					in:fly={prefersReducedMotion() ? { duration: 0 } : { y: 24, delay: i * 100 }}
				>
					<div class="leaderboard-podium-rank num allcaps">#{row.entry.rank}</div>
					<div class="leaderboard-podium-avatar-wrap">
						<Avatar
							class={i === 0 ? 'leaderboard-podium-avatar-lg' : 'leaderboard-podium-avatar-md'}
							avatar={row.avatar ?? null}
							nickname={row.nickname ?? null}
							owner={row.owner}
							self={row.isSelf}
						/>
					</div>
					<div class="leaderboard-podium-name">
						{row.isSelf ? t({ locale: $localeStore, key: 'leaderboard.you' }) : handleOf(row)}
					</div>
					<div class="leaderboard-podium-acc num">{row.entry.accuracy}%</div>
					<div class="leaderboard-podium-vxp num">
						{t({
							locale: $localeStore,
							key: 'leaderboard.row.vxp',
							params: { vxp: rankingVxp(row.entry) }
						})}
					</div>
				</button>
			{/each}
		</div>

		<!-- Flat list of rest rows. -->
		<ul class="leaderboard-rows">
			{#each rest as row, i (row.owner)}
				<li in:fade={{ delay: i * 20 }}>
					<button
						class="leaderboard-row"
						class:is-you={row.isSelf}
						aria-label={row.isSelf
							? undefined
							: t({
									locale: $localeStore,
									key: 'leaderboard.open_profile_aria',
									params: { name: handleOf(row) }
								})}
						disabled={row.isSelf}
						onclick={() => openSheet(row)}
						type="button"
					>
						<span class="leaderboard-row-left">
							<span class="leaderboard-row-rank-wrap">
								<span class="leaderboard-row-rank num">#{row.entry.rank}</span>
								{@render rankDelta(row.entry.rankDelta)}
							</span>
							<Avatar
								class="leaderboard-row-avatar"
								avatar={row.avatar ?? null}
								nickname={row.nickname ?? null}
								owner={row.owner}
								self={row.isSelf}
							/>
							<span class="leaderboard-row-text">
								<span class="leaderboard-row-handle">
									{row.isSelf ? t({ locale: $localeStore, key: 'leaderboard.you' }) : handleOf(row)}
								</span>
								<span class="leaderboard-row-meta num">
									{t({
										locale: $localeStore,
										key: 'leaderboard.row.vxp',
										params: { vxp: rankingVxp(row.entry) }
									})} · {t({
										locale: $localeStore,
										key: 'leaderboard.row.streak',
										params: { count: row.streak }
									})}
								</span>
							</span>
						</span>
						<span class="leaderboard-row-acc num" class:is-strong={row.entry.accuracy >= 78}>
							{row.entry.accuracy}%
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<!-- Mini-profile bottom sheet — opens on row / podium tap. Shows the tapped
     predictor's window accuracy, settled count and streak with an add- or
     remove-friend action that routes through the shared relation services. -->
<BottomSheet isOpen={openRow !== undefined} onClose={closeSheet}>
	{#if openRow}
		{@const row = openRow}
		{@const friend = isFriend(row.owner)}
		{@const sentDoc = pendingSentDoc(row.owner)}
		{@const pending = !friend && sentDoc !== undefined}
		<div class="lb-sheet-head">
			<span class="lb-sheet-avatar">
				<Avatar
					class="h-full w-full"
					avatar={row.avatar ?? null}
					nickname={row.nickname ?? null}
					owner={row.owner}
				/>
			</span>
			<div class="lb-sheet-head-copy">
				<span class="lb-sheet-name">@{handleOf(row)}</span>
				<span class="num lb-sheet-sub">
					{t({
						locale: $localeStore,
						key: 'leaderboard.sheet.rank_streak',
						params: { rank: rankOf(row.owner), count: row.streak }
					})}
				</span>
			</div>
		</div>

		<div class="lb-sheet-stats">
			<div class="lb-sheet-stat">
				<span class="lb-sheet-lbl">
					{t({ locale: $localeStore, key: 'arena.friends.sheet.accuracy' })}
				</span>
				<span class="lb-sheet-val num">{row.entry.accuracy}%</span>
			</div>
			<div class="lb-sheet-stat">
				<span class="lb-sheet-lbl">
					{t({ locale: $localeStore, key: 'leaderboard.sheet.settled' })}
				</span>
				<span class="lb-sheet-val num">{row.entry.settledCount}</span>
			</div>
			<div class="lb-sheet-stat">
				<span class="lb-sheet-lbl">
					{t({ locale: $localeStore, key: 'arena.friends.sheet.streak' })}
				</span>
				<span class="lb-sheet-val num">{row.streak}d</span>
			</div>
		</div>

		<BaseButton
			class={friend
				? 'lb-sheet-action lb-sheet-remove'
				: pending
					? 'lb-sheet-action lb-sheet-pending'
					: 'lb-sheet-action lb-sheet-add'}
			onclick={handleToggleFriend}
			status={mutatingOwner === row.owner ? 'pending' : 'enabled'}
		>
			{#if friend}
				<UserMinus aria-hidden="true" size={15} strokeWidth={1.8} />
				{t({ locale: $localeStore, key: 'arena.friends.sheet.remove' })}
			{:else if pending}
				{t({ locale: $localeStore, key: 'leaderboard.sheet.requested' })}
				<span class="lb-sheet-pending-cancel">
					{t({ locale: $localeStore, key: 'leaderboard.sheet.cancel_request' })}
				</span>
			{:else}
				<UserPlus aria-hidden="true" size={15} strokeWidth={1.8} />
				{t({ locale: $localeStore, key: 'leaderboard.sheet.add_friend' })}
			{/if}
		</BaseButton>
		<BaseButton class="lb-sheet-close" onclick={closeSheet}>
			{t({ locale: $localeStore, key: 'arena.friends.sheet.close' })}
		</BaseButton>
	{/if}
</BottomSheet>

<style lang="postcss">
	.leaderboard-page {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0 1.25rem 6rem;
	}

	/* Window chip strip — `This week / This month / All time`. */
	.leaderboard-scopes {
		display: flex;
		gap: 0.375rem;
		padding: 0.25rem 0 0.875rem;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.leaderboard-scopes::-webkit-scrollbar {
		display: none;
	}

	.leaderboard-scope {
		appearance: none;
		display: inline-flex;
		align-items: center;
		/* ≥44px tap target on the window tab control while the chip keeps its
		   compact visual height. */
		min-height: 44px;
		padding: 0.4rem 0.875rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-muted);
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		cursor: pointer;
		white-space: nowrap;
		transition:
			color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici);
	}

	.leaderboard-scope:hover {
		color: var(--text-base);
		border-color: var(--border-strong);
	}

	.leaderboard-scope.is-active {
		color: var(--text-base);
		border-color: color-mix(in srgb, var(--color-primary) 50%, var(--border-base));
		background: color-mix(in srgb, var(--color-primary) 12%, var(--bg-surface));
	}

	/* Podium — three tiles in a row. Tile 0 is #1 (the gold one). */
	.leaderboard-podium {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.leaderboard-podium-tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		padding: 0.75rem 0.5rem;
		appearance: none;
		font: inherit;
		color: inherit;
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		text-align: center;
		cursor: pointer;
		transition: border-color var(--d-hover) var(--ease-vici);
	}

	.leaderboard-podium-tile:disabled {
		cursor: default;
	}

	.leaderboard-podium-tile:not(:disabled):hover {
		border-color: var(--border-strong);
	}

	.leaderboard-podium-tile.is-first {
		border-color: color-mix(in srgb, #f4c544 45%, var(--border-base));
		background: color-mix(in srgb, #f4c544 6%, var(--bg-surface));
	}

	.leaderboard-podium-tile.is-first:not(:disabled):hover {
		border-color: color-mix(in srgb, #f4c544 60%, var(--border-base));
	}

	.leaderboard-podium-tile.is-you {
		border-color: color-mix(in srgb, var(--color-primary) 45%, var(--border-base));
		background: color-mix(in srgb, var(--color-primary) 8%, var(--bg-surface));
	}

	.leaderboard-podium-rank {
		font-size: var(--t-11);
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}

	.leaderboard-podium-tile.is-first .leaderboard-podium-rank {
		color: #f4c544;
	}

	.leaderboard-podium-avatar-wrap {
		display: flex;
		justify-content: center;
		margin-top: 0.15rem;
	}

	:global(.leaderboard-podium-avatar-lg) {
		width: 3rem;
		height: 3rem;
	}

	:global(.leaderboard-podium-avatar-md) {
		width: 2.25rem;
		height: 2.25rem;
	}

	.leaderboard-podium-name {
		max-width: 100%;
		margin-top: 0.25rem;
		font-size: var(--t-12);
		font-weight: 600;
		color: var(--text-base);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.leaderboard-podium-acc {
		margin-top: 0.1rem;
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--color-primary);
	}

	/* The VXP that drives the rank, under the headline accuracy. */
	.leaderboard-podium-vxp {
		margin-top: 0.05rem;
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}

	/* Rest rows — simple flat row card. */
	.leaderboard-rows {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.leaderboard-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.75rem 0.875rem;
		appearance: none;
		font: inherit;
		color: inherit;
		text-align: left;
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		cursor: pointer;
		transition: border-color var(--d-hover) var(--ease-vici);
	}

	.leaderboard-row:disabled {
		cursor: default;
	}

	.leaderboard-row:not(:disabled):hover {
		border-color: var(--border-strong);
	}

	/* Your own row reads as a personal highlight: an accent gradient that
	   fades to the surface, plus an accent-tinted border. The rank and handle
	   pick up the accent colour + extra weight below. */
	.leaderboard-row.is-you {
		border-color: color-mix(in srgb, var(--color-primary) 45%, var(--border-base));
		background: linear-gradient(
			90deg,
			var(--accent-glow, color-mix(in srgb, var(--color-primary) 16%, transparent)),
			transparent
		);
	}

	.leaderboard-row.is-you .leaderboard-row-handle {
		color: var(--color-primary);
		font-weight: 700;
	}

	.leaderboard-row-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.leaderboard-row-rank-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.1rem;
		width: 2rem;
	}

	.leaderboard-row-rank {
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-muted);
	}

	.leaderboard-row.is-you .leaderboard-row-rank {
		color: var(--color-primary);
		font-weight: 700;
	}

	/* ↑/↓ rank-delta pill under the rank number. */
	.lb-delta {
		display: inline-flex;
		align-items: center;
		gap: 0.05rem;
		font-size: 0.6rem;
		font-weight: 700;
		line-height: 1;
	}

	.lb-delta-up {
		color: var(--yes);
	}

	.lb-delta-down {
		color: var(--no);
	}

	.lb-delta-flat {
		color: var(--text-muted);
		opacity: 0.6;
	}

	:global(.leaderboard-row-avatar) {
		width: 1.75rem;
		height: 1.75rem;
		flex-shrink: 0;
	}

	.leaderboard-row-text {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.leaderboard-row-handle {
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-base);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.leaderboard-row-meta {
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}

	.leaderboard-row-acc {
		font-size: var(--t-14);
		font-weight: 600;
		color: var(--text-base);
	}

	.leaderboard-row-acc.is-strong {
		color: var(--yes);
	}

	.leaderboard-loading,
	.leaderboard-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.875rem;
		padding: 3rem 1rem;
		color: var(--text-muted);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
	}

	.leaderboard-empty-sub {
		max-width: 18rem;
		font-size: var(--t-12);
		font-weight: 500;
		letter-spacing: normal;
		text-align: center;
		text-transform: none;
		color: var(--text-muted);
	}

	.leaderboard-spinner {
		width: 2.5rem;
		height: 2.5rem;
		border: 3px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: leaderboard-spin 720ms linear infinite;
	}

	@keyframes leaderboard-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.leaderboard-spinner {
			animation-duration: 1.6s;
		}
	}

	/* ── Mini-profile sheet body ─────────────────────────────────── */
	.lb-sheet-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.25rem 0 0.85rem;
	}

	.lb-sheet-avatar {
		display: inline-flex;
		overflow: hidden;
		width: 3rem;
		height: 3rem;
		flex-shrink: 0;
		border-radius: var(--r-pill);
		background: var(--bg-surface);
	}

	.lb-sheet-head-copy {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.15rem;
	}

	.lb-sheet-name {
		color: var(--text-base);
		font-size: var(--t-16);
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.lb-sheet-sub {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: var(--t-10);
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.lb-sheet-stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
		margin-bottom: 0.85rem;
		padding: 0.75rem 0;
		border-top: 1px solid var(--border-base);
		border-bottom: 1px solid var(--border-base);
	}

	.lb-sheet-stat {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		text-align: center;
	}

	.lb-sheet-lbl {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.lb-sheet-val {
		color: var(--text-base);
		font-size: var(--t-16);
		font-weight: 700;
	}

	:global(.lb-sheet-action) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		width: 100%;
		padding: 0.75rem;
		border-radius: var(--r-pill);
		font-size: var(--t-13);
		font-weight: 700;
	}

	:global(.lb-sheet-add) {
		border: 1px solid color-mix(in srgb, var(--color-primary) 45%, var(--border-base));
		background: var(--color-primary);
		color: var(--color-primary-foreground, white);
	}

	:global(.lb-sheet-remove) {
		border: 1px solid var(--border-base);
		background: var(--bg-surface);
		color: var(--no);
	}

	:global(.lb-sheet-pending) {
		flex-direction: column;
		gap: 0.15rem;
		border: 1px solid var(--border-base);
		background: var(--bg-surface);
		color: var(--text-muted);
	}

	.lb-sheet-pending-cancel {
		font-size: var(--t-11);
		color: var(--no);
		font-weight: 600;
	}

	:global(.lb-sheet-close) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 0.65rem;
		margin-top: 0.4rem;
		border: 0;
		border-radius: var(--r-pill);
		background: transparent;
		color: var(--text-muted);
		font-size: var(--t-13);
		font-weight: 700;
	}
</style>
