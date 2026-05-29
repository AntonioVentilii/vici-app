<script lang="ts">
	import { Check, ChevronRight, Copy } from 'lucide-svelte/icons';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { LeagueDoc } from '$lib/types/league';
	import type { LeagueMemberRole } from '$lib/types/league-member';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Single row in the Leagues list. Renders the gradient logo
	 * tile, the league name + role chip, a member-count + your-rank
	 * meta line, an optional friend-overlap row, an optional latest-
	 * activity preview line, and an inline copy-invite pill on the
	 * trailing edge.
	 *
	 * The card itself is a `<button>` that routes to the league
	 * detail page; the copy pill is a nested button that stops
	 * propagation so the row click + copy gesture don't fight.
	 */
	interface FriendOverlap {
		/** The first friend's handle (no leading `@`). */
		handle: string;
		/** Total friends in this league, ≥1. */
		count: number;
	}

	interface Props {
		league: LeagueDoc;
		/** Caller's role. `undefined` for recommendation cards (caller
		 *  is not a member). */
		role?: LeagueMemberRole;
		/** Total members in this league. */
		memberCount: number;
		/** Friend-overlap summary, or `undefined` when no friends
		 *  are in this league. */
		friendOverlap?: FriendOverlap;
		/** Free-form "latest activity" preview. Hidden when undefined. */
		activityPreview?: string;
		/** Marks this card as a recommendation (friends are in, you
		 *  are not). Swaps the role chip for a `REQUEST` chip and
		 *  hides the copy pill. */
		isRecommendation?: boolean;
		/** Click handler — opens the league detail page (or join
		 *  flow for recommendations). */
		onclick: () => void;
	}

	const {
		league,
		role,
		memberCount,
		friendOverlap,
		activityPreview,
		isRecommendation = false,
		onclick
	}: Props = $props();

	let copied = $state(false);

	/**
	 * The 1-char emblem rendered inside the gradient tile. Leagues
	 * don't carry a stored emblem field, so we derive it from the
	 * first ASCII letter of the name — Unicode-safe (`Array.from`
	 * splits by code point) and falls back to a glyph if the league
	 * name is non-alphabetic.
	 */
	const emblem = $derived.by(() => {
		const [first] = Array.from(league.name.trim());

		return first ? first.toUpperCase() : '◆';
	});

	const accent = $derived(league.accentColor ?? '#7e9b6a');

	const roleLabel = $derived.by(() => {
		if (!role) {
			return;
		}

		const key =
			role === 'owner'
				? 'leagues.role.owner'
				: role === 'admin'
					? 'leagues.role.admin'
					: 'leagues.role.member';

		return t({ locale: $localeStore, key });
	});

	const memberCountLabel = $derived(
		t({
			locale: $localeStore,
			key: memberCount === 1 ? 'leagues.card.member_count_one' : 'leagues.card.member_count_many',
			params: { count: memberCount }
		})
	);

	// The handle is rendered as a separate emphasised span; the suffix
	// covers the "+ N friends" tail. For a single friend the suffix is
	// empty — `<b>@handle</b>` stands on its own.
	const friendOverlapSuffix = $derived.by(() => {
		if (!friendOverlap || friendOverlap.count <= 1) {
			return;
		}

		const others = friendOverlap.count - 1;

		return t({
			locale: $localeStore,
			key:
				others === 1
					? 'leagues.card.friend_overlap_suffix_one'
					: 'leagues.card.friend_overlap_suffix_many',
			params: { count: others }
		});
	});

	const handleCopy = async (event: MouseEvent) => {
		event.stopPropagation();

		try {
			await navigator.clipboard.writeText(`vici.markets/league/${league.inviteCode}`);
			copied = true;

			setTimeout(() => {
				copied = false;
			}, 1500);
		} catch (err) {
			console.error('LeagueListCard: clipboard write failed', err);
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'common.error.generic' }),
				message: '',
				type: 'error'
			});
		}
	};
</script>

<button
	style:--accent={accent}
	style:--accent-grad={`linear-gradient(160deg, ${accent}33 0%, ${accent}11 40%, var(--bg-surface) 100%)`}
	class="league-list-card"
	class:is-recommendation={isRecommendation}
	{onclick}
	type="button"
>
	<span class="league-logo" aria-hidden="true">
		<span class="emblem">{emblem}</span>
	</span>

	<span class="body">
		<span class="head">
			<span class="name">{league.name}</span>
			{#if isRecommendation}
				<span class="role-chip is-recommendation allcaps">
					{t({ locale: $localeStore, key: 'leagues.card.recommend_chip' })}
				</span>
			{:else if roleLabel && role !== 'member'}
				<span class="role-chip allcaps" data-role={role}>{roleLabel}</span>
			{/if}
		</span>

		<span class="meta num">{memberCountLabel}</span>

		{#if friendOverlap}
			<span class="friend-overlap">
				<span class="friend-avatars" aria-hidden="true">
					{#each Array.from({ length: Math.min(friendOverlap.count, 3) }) as _, i (i)}
						<span style:--i={i} class="friend-avatar-dot"></span>
					{/each}
				</span>
				<span class="friend-overlap-text num">
					<b class="friend-overlap-handle">{friendOverlap.handle}</b>
					{#if friendOverlapSuffix}
						<span class="friend-overlap-suffix">{friendOverlapSuffix}</span>
					{/if}
				</span>
			</span>
		{/if}

		{#if activityPreview}
			<span class="activity-preview">{activityPreview}</span>
		{/if}
	</span>

	<span class="trailing">
		<ChevronRight aria-hidden="true" size={16} strokeWidth={1.6} />
		{#if !isRecommendation}
			<!-- Nested interactive control inside a button is technically
			     invalid HTML; we use a `<span role="button">` so the
			     copy pill stays accessible without nesting buttons. -->
			<span
				class="copy-pill allcaps"
				class:is-copied={copied}
				aria-label={t({
					locale: $localeStore,
					key: copied ? 'leagues.card.copy_done' : 'leagues.card.copy'
				})}
				onclick={handleCopy}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						void handleCopy(e as unknown as MouseEvent);
					}
				}}
				role="button"
				tabindex="0"
			>
				{#if copied}
					<Check aria-hidden="true" size={11} strokeWidth={2.4} />
					{t({ locale: $localeStore, key: 'leagues.card.copy_done' })}
				{:else}
					<Copy aria-hidden="true" size={11} strokeWidth={2} />
					{t({ locale: $localeStore, key: 'leagues.card.copy' })}
				{/if}
			</span>
		{/if}
	</span>
</button>

<style lang="postcss">
	.league-list-card {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		width: 100%;
		padding: 0.85rem 0.95rem;
		font: inherit;
		text-align: left;
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici);
	}

	.league-list-card:hover {
		background: color-mix(in srgb, var(--bg-surface) 75%, transparent);
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border-base));
	}

	.league-list-card.is-recommendation {
		border-style: dashed;
		opacity: 0.95;
	}

	.league-logo {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 2.5rem;
		height: 2.5rem;
		background: var(--accent-grad);
		border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
		border-radius: var(--r-8);
	}

	.league-logo .emblem {
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 600;
		color: var(--accent);
		line-height: 1;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: 0.18rem;
		flex: 1;
		min-width: 0;
	}

	.head {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	.name {
		font-family: var(--font-display);
		font-size: var(--t-15, 0.9375rem);
		font-weight: 600;
		color: var(--text-base);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.role-chip {
		flex-shrink: 0;
		font-size: var(--t-10, 0.6rem);
		letter-spacing: var(--tracking-allcaps);
		padding: 0.1rem 0.4rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		color: var(--accent);
	}

	.role-chip[data-role='owner'] {
		background: color-mix(in srgb, var(--laurel) 22%, transparent);
		color: var(--laurel);
	}

	.role-chip.is-recommendation {
		background: color-mix(in srgb, var(--color-primary) 18%, transparent);
		color: var(--color-primary);
	}

	.meta {
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
		letter-spacing: 0.04em;
	}

	.friend-overlap {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		margin-top: 0.15rem;
	}

	.friend-avatars {
		display: inline-flex;
	}

	.friend-avatar-dot {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		border-radius: 999px;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-primary) 65%, transparent),
			color-mix(in srgb, var(--accent) 55%, transparent)
		);
		border: 1px solid color-mix(in srgb, var(--bg-surface) 50%, var(--border-base));
		margin-left: -0.35rem;
	}

	.friend-avatar-dot:first-child {
		margin-left: 0;
	}

	.friend-overlap-text {
		font-size: var(--t-10, 0.6rem);
		color: var(--text-muted);
		letter-spacing: 0.04em;
	}

	.friend-overlap-handle {
		color: var(--color-primary);
		font-weight: 700;
	}

	.friend-overlap-suffix {
		margin-left: 0.2rem;
	}

	.activity-preview {
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
		line-height: 1.35;
		font-style: italic;
	}

	.trailing {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.4rem;
		flex-shrink: 0;
		color: var(--text-muted);
	}

	.copy-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.18rem 0.45rem;
		font-size: var(--t-10, 0.6rem);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 60%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		cursor: pointer;
		user-select: none;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici);
	}

	.copy-pill:hover {
		background: color-mix(in srgb, var(--bg-surface) 30%, transparent);
		border-color: var(--border-strong);
	}

	.copy-pill.is-copied {
		color: var(--color-primary);
		border-color: color-mix(in srgb, var(--color-primary) 55%, var(--border-base));
	}
</style>
