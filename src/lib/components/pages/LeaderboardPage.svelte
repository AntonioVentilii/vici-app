<script lang="ts">
	import { Users } from 'lucide-svelte/icons';
	import { fade, fly } from 'svelte/transition';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import { leaderboard, leaderboardNotInitialized } from '$lib/derived/leaderboard.derived';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import type { UserProfile } from '$lib/types/profile';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';

	/**
	 * Global leaderboard — port of the design source's
	 * `LeaderboardScreen` (`screens.jsx:1169-1273`).
	 *
	 * Three scoped tabs: `This week`, `This month`, `All time`. The
	 * data feeding all three is the same global `$leaderboard` for
	 * now — when the backend gains time-window filtering each scope
	 * will route to its own slice.
	 *
	 * Layout is a single column:
	 *  - chip-style scope tabs at the top
	 *  - 3-card podium row (top-3, #1 gets the laurel halo + tinted bg)
	 *  - flat list of rest rows (rank, avatar, handle + VXP + streak,
	 *    accuracy on the right)
	 *
	 * The viewer's own row carries an accent border + tinted bg.
	 *
	 * Activity feed and friends-only filter (extra tabs the earlier
	 * version added) are not part of this surface — friends rankings
	 * live on the Friends tab inside Arena.
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

	<!-- Scope chips — `This week / This month / All time`. Plain
	     chip-style buttons (no pill background on active) matching
	     `screens.jsx:1205-1209`. -->
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
		<!-- 3-card podium row. #1 gets the laurel halo + tinted
		     background; #2 / #3 stay on the neutral surface. -->
		<div class="leaderboard-podium">
			{#each podium as user, i (user.owner)}
				<div
					class="leaderboard-podium-tile"
					class:is-first={i === 0}
					class:is-you={user.owner === currentUser}
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
						{user.owner === currentUser
							? t({ locale: $localeStore, key: 'leaderboard.you' })
							: user.nickname}
					</div>
					<div class="leaderboard-podium-acc num">{Math.round(user.accuracy ?? 0)}%</div>
				</div>
			{/each}
		</div>

		<!-- Flat list of rest rows. -->
		<ul class="leaderboard-rows">
			{#each rest as user, i (user.owner)}
				<li
					class="leaderboard-row"
					class:is-you={user.owner === currentUser}
					in:fade={{ delay: i * 20 }}
				>
					<div class="leaderboard-row-left">
						<span class="leaderboard-row-rank num">#{i + 4}</span>
						<Avatar
							class="leaderboard-row-avatar"
							avatar={user.avatar}
							nickname={user.nickname}
							owner={user.owner}
						/>
						<div class="leaderboard-row-text">
							<span class="leaderboard-row-handle">
								{user.owner === currentUser
									? t({ locale: $localeStore, key: 'leaderboard.you' })
									: user.nickname}
							</span>
							<span class="leaderboard-row-meta num">
								{Math.floor(user.points ?? 0).toLocaleString('en-US')} VXP · {t({
									locale: $localeStore,
									key: 'leaderboard.row.streak',
									params: { count: user.dailyStreak ?? 0 }
								})}
							</span>
						</div>
					</div>
					<span class="leaderboard-row-acc num" class:is-strong={(user.accuracy ?? 0) >= 78}>
						{Math.round(user.accuracy ?? 0)}%
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style lang="postcss">
	.leaderboard-page {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0 1.25rem 6rem;
	}

	/* Scope chip strip — matches `screens.jsx:1205-1208`. */
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
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		text-align: center;
	}

	.leaderboard-podium-tile.is-first {
		border-color: color-mix(in srgb, #f4c544 45%, var(--border-base));
		background: color-mix(in srgb, #f4c544 6%, var(--bg-surface));
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
		padding: 0.75rem 0.875rem;
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
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
</style>
