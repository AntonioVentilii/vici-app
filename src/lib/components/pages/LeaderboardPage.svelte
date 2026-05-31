<script lang="ts">
	import type { Doc } from '@junobuild/core';
	import { UserMinus, UserPlus, Users } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import { leaderboard, leaderboardNotInitialized } from '$lib/derived/leaderboard.derived';
	import { authPrincipal } from '$lib/derived/user.derived';
	import {
		cancelFriendRequest,
		sendFriendRequest,
		unfriendUser
	} from '$lib/services/relation.services';
	import {
		friendsListStore,
		refreshFriendRelations,
		sentFriendRequestsStore
	} from '$lib/stores/friends.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { UserProfile } from '$lib/types/profile';
	import type { Relation } from '$lib/types/relation';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';

	/**
	 * Global leaderboard.
	 *
	 * Three scoped tabs (`This week` / `This month` / `All time`) all
	 * read the same global `$leaderboard` for now — when the backend
	 * gains time-window filtering each scope routes to its own slice.
	 *
	 * Layout is a single column:
	 *  - chip-style scope tabs at the top
	 *  - 3-tile podium row (top-3, #1 gets the gold halo + tinted bg)
	 *  - flat list of rest rows (rank, avatar, handle + VXP + streak,
	 *    accuracy on the right — coloured `--yes` once accuracy ≥ 78%)
	 *
	 * The viewer's own row carries an accent border + tinted bg and is
	 * never tappable. Every other row / podium tile is a real button
	 * that opens a mini-profile bottom sheet surfacing accuracy / VXP /
	 * streak with an add- or remove-friend action. Friend state reads
	 * from the shared `friendsListStore`, and add/remove route through
	 * the same `relation.services` the Friends tab uses, so the inbox
	 * badge and Arena tab stay in lockstep.
	 */

	type Scope = 'week' | 'month' | 'all';

	const scopes: { id: Scope; labelKey: MessageKey }[] = [
		{ id: 'week', labelKey: 'leaderboard.scope.week' },
		{ id: 'month', labelKey: 'leaderboard.scope.month' },
		{ id: 'all', labelKey: 'leaderboard.scope.all' }
	];

	let activeScope = $state<Scope>('week');
	const currentUser = $derived($authPrincipal);

	const loading = $derived($leaderboardNotInitialized);

	const rankedUsers: UserProfile[] = $derived($leaderboard);

	const podium = $derived(rankedUsers.slice(0, 3));
	const rest = $derived(rankedUsers.slice(3));

	// Rank is implicit in the array order; expose it so the sheet can
	// show `#N global` without re-deriving the index from the row.
	const rankOf = (owner: string): number => rankedUsers.findIndex((u) => u.owner === owner) + 1;

	// ── Friend state ────────────────────────────────────────────────
	// `friendsListStore` holds accepted friend relations; `sentFriendRequestsStore`
	// holds outgoing requests still awaiting the recipient's response.
	// Three states: accepted friend, outgoing-pending, or none.
	const friendOwners = $derived(
		new Set(
			$friendsListStore.flatMap((relation) =>
				relation.participants.filter((p) => p !== currentUser)
			)
		)
	);

	const isFriend = (owner: string): boolean => friendOwners.has(owner);

	// Returns the pending-sent Doc for `owner`, or undefined if none.
	const pendingSentDoc = (owner: string): Doc<Relation> | undefined =>
		$sentFriendRequestsStore.find((doc) => doc.data.participants.includes(owner));

	onMount(() => {
		// Hydrate the shared social graph so `isFriend` is accurate on
		// first paint. The store is stale-while-revalidate, so a warm
		// cache renders instantly and this just refreshes in the back.
		void refreshFriendRelations();
	});

	// ── Mini-profile bottom sheet ───────────────────────────────────
	let openProfile = $state<UserProfile | undefined>(undefined);
	let mutatingOwner = $state<string | undefined>(undefined);

	const openSheet = (user: UserProfile) => {
		// The viewer's own row is informational — there's nothing to add.
		if (user.owner === currentUser) {
			return;
		}

		openProfile = user;
	};

	const closeSheet = () => {
		openProfile = undefined;
	};

	const accuracyOf = (user: UserProfile): number => Math.round(user.accuracy ?? 0);
	const vxpOf = (user: UserProfile): string => Math.round(user.points ?? 0).toLocaleString('en-US');
	const streakOf = (user: UserProfile): number => user.streak ?? 0;

	const handleToggleFriend = async () => {
		if (!openProfile || !currentUser) {
			return;
		}

		const target = openProfile.owner;
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
			openProfile = undefined;
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

{#snippet leaderboardAppbarRight()}
	<button
		class="appbar-icon-btn"
		aria-label={t({ locale: $localeStore, key: 'leaderboard.friends_aria' })}
		type="button"
	>
		<Users size={18} strokeWidth={1.8} />
	</button>
{/snippet}

<div class="leaderboard-page">
	<MobileAppBar
		align="left"
		right={leaderboardAppbarRight}
		title={t({ locale: $localeStore, key: 'leaderboard.title' })}
	/>

	<!-- Scope chips — `This week / This month / All time`. -->
	<div class="leaderboard-scopes" role="tablist">
		{#each scopes as scope (scope.id)}
			<button
				class="leaderboard-scope"
				class:is-active={activeScope === scope.id}
				aria-selected={activeScope === scope.id}
				onclick={() => (activeScope = scope.id)}
				role="tab"
				type="button"
			>
				{t({ locale: $localeStore, key: scope.labelKey })}
			</button>
		{/each}
	</div>

	{#if loading}
		<div class="leaderboard-loading">
			<div class="leaderboard-spinner"></div>
			<p class="allcaps">{t({ locale: $localeStore, key: 'leaderboard.loading' })}</p>
		</div>
	{:else if rankedUsers.length === 0}
		<div class="leaderboard-empty">
			<p class="allcaps">{t({ locale: $localeStore, key: 'leaderboard.empty' })}</p>
		</div>
	{:else}
		<!-- 3-tile podium row. #1 gets the gold halo + tinted bg; #2 / #3
		     stay on the neutral surface. Every tile but the viewer's own
		     is a real button that opens the mini-profile sheet. -->
		<div class="leaderboard-podium">
			{#each podium as user, i (user.owner)}
				{@const isYou = user.owner === currentUser}
				<button
					class="leaderboard-podium-tile"
					class:is-first={i === 0}
					class:is-you={isYou}
					aria-label={isYou
						? undefined
						: t({
								locale: $localeStore,
								key: 'leaderboard.open_profile_aria',
								params: { name: user.nickname }
							})}
					disabled={isYou}
					onclick={() => openSheet(user)}
					type="button"
					in:fly={prefersReducedMotion() ? { duration: 0 } : { y: 24, delay: i * 100 }}
				>
					<div class="leaderboard-podium-rank num allcaps">#{i + 1}</div>
					<div class="leaderboard-podium-avatar-wrap">
						<Avatar
							class={i === 0 ? 'leaderboard-podium-avatar-lg' : 'leaderboard-podium-avatar-md'}
							avatar={user.avatar}
							nickname={user.nickname}
							owner={user.owner}
						/>
					</div>
					<div class="leaderboard-podium-name">
						{isYou ? t({ locale: $localeStore, key: 'leaderboard.you' }) : user.nickname}
					</div>
					<div class="leaderboard-podium-acc num">{accuracyOf(user)}%</div>
				</button>
			{/each}
		</div>

		<!-- Flat list of rest rows. -->
		<ul class="leaderboard-rows">
			{#each rest as user, i (user.owner)}
				{@const isYou = user.owner === currentUser}
				<li in:fade={{ delay: i * 20 }}>
					<button
						class="leaderboard-row"
						class:is-you={isYou}
						aria-label={isYou
							? undefined
							: t({
									locale: $localeStore,
									key: 'leaderboard.open_profile_aria',
									params: { name: user.nickname }
								})}
						disabled={isYou}
						onclick={() => openSheet(user)}
						type="button"
					>
						<span class="leaderboard-row-left">
							<span class="leaderboard-row-rank num">#{i + 4}</span>
							<Avatar
								class="leaderboard-row-avatar"
								avatar={user.avatar}
								nickname={user.nickname}
								owner={user.owner}
							/>
							<span class="leaderboard-row-text">
								<span class="leaderboard-row-handle">
									{isYou ? t({ locale: $localeStore, key: 'leaderboard.you' }) : user.nickname}
								</span>
								<span class="leaderboard-row-meta num">
									{vxpOf(user)} VXP · {t({
										locale: $localeStore,
										key: 'leaderboard.row.streak',
										params: { count: streakOf(user) }
									})}
								</span>
							</span>
						</span>
						<span class="leaderboard-row-acc num" class:is-strong={accuracyOf(user) >= 78}>
							{accuracyOf(user)}%
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<!-- Mini-profile bottom sheet — opens on row / podium tap. Shows the
     tapped predictor's accuracy, VXP and streak with an add- or
     remove-friend action that routes through the shared relation
     services. -->
<BottomSheet isOpen={openProfile !== undefined} onClose={closeSheet}>
	{#if openProfile}
		{@const user = openProfile}
		{@const friend = isFriend(user.owner)}
		{@const sentDoc = pendingSentDoc(user.owner)}
		{@const pending = !friend && sentDoc !== undefined}
		<div class="lb-sheet-head">
			<span class="lb-sheet-avatar">
				<Avatar
					class="h-full w-full"
					avatar={user.avatar}
					nickname={user.nickname}
					owner={user.owner}
				/>
			</span>
			<div class="lb-sheet-head-copy">
				<span class="lb-sheet-name">@{user.nickname}</span>
				<span class="num lb-sheet-sub">
					{t({
						locale: $localeStore,
						key: 'leaderboard.sheet.rank_streak',
						params: { rank: rankOf(user.owner), count: streakOf(user) }
					})}
				</span>
			</div>
		</div>

		<div class="lb-sheet-stats">
			<div class="lb-sheet-stat">
				<span class="lb-sheet-lbl"
					>{t({ locale: $localeStore, key: 'arena.friends.sheet.accuracy' })}</span
				>
				<span class="lb-sheet-val num">{accuracyOf(user)}%</span>
			</div>
			<div class="lb-sheet-stat">
				<span class="lb-sheet-lbl"
					>{t({ locale: $localeStore, key: 'arena.friends.sheet.vxp' })}</span
				>
				<span class="lb-sheet-val num">{vxpOf(user)}</span>
			</div>
			<div class="lb-sheet-stat">
				<span class="lb-sheet-lbl"
					>{t({ locale: $localeStore, key: 'arena.friends.sheet.streak' })}</span
				>
				<span class="lb-sheet-val num">{streakOf(user)}d</span>
			</div>
		</div>

		<BaseButton
			class={friend
				? 'lb-sheet-action lb-sheet-remove'
				: pending
					? 'lb-sheet-action lb-sheet-pending'
					: 'lb-sheet-action lb-sheet-add'}
			onclick={handleToggleFriend}
			status={mutatingOwner === user.owner ? 'pending' : 'enabled'}
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

	/* Scope chip strip — `This week / This month / All time`. */
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

	.leaderboard-row.is-you {
		border-color: color-mix(in srgb, var(--color-primary) 45%, var(--border-base));
		background: color-mix(in srgb, var(--color-primary) 8%, var(--bg-surface));
	}

	.leaderboard-row-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.leaderboard-row-rank {
		width: 1.5rem;
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-muted);
	}

	.leaderboard-row.is-you .leaderboard-row-rank {
		color: var(--color-primary);
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
