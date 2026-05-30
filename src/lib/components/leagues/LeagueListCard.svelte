<script lang="ts">
	import { Check, ChevronRight } from 'lucide-svelte/icons';
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
			const url = `${window.location.origin}/league/${league.inviteCode}`;
			const shareText = t({
				locale: $localeStore,
				key: 'leagues.share_text',
				params: { name: league.name }
			});
			await navigator.clipboard.writeText(`${shareText} ${url}`);
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
	style:--accent-grad={`linear-gradient(160deg, ${accent}33 0%, ${accent}11 40%, rgba(20, 18, 15, 0.95) 100%)`}
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
				<span class="role-chip is-recommendation">
					{t({ locale: $localeStore, key: 'leagues.card.recommend_chip' }).toUpperCase()}
				</span>
			{:else if roleLabel && role !== 'member'}
				<span class="role-chip" data-role={role}>{roleLabel.toUpperCase()}</span>
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
				class="copy-pill"
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
					{t({ locale: $localeStore, key: 'leagues.card.copy' })}
				{/if}
			</span>
		{/if}
	</span>
</button>

<style lang="postcss">
	/* 3-col grid (56 px icon · 1fr body · auto trailing meta column)
	   with the same 56-px tile dimensions as the Create / Join CTA
	   tiles so the leagues list reads as a single uniform column
	   regardless of whether the row is a real league or a CTA. 12 px
	   radius + raised surface + a -1 px hover lift mark interactive
	   rows. */
	.league-list-card {
		display: grid;
		grid-template-columns: 56px 1fr auto;
		gap: 12px;
		align-items: center;
		width: 100%;
		padding: 14px;
		font: inherit;
		text-align: left;
		color: var(--text-base);
		background: var(--bg-popover);
		border: 1px solid var(--border-base);
		border-radius: 12px;
		cursor: pointer;
		transition:
			background-color 180ms var(--ease-vici),
			border-color 180ms var(--ease-vici),
			transform 100ms var(--ease-vici);
	}

	.league-list-card:hover {
		background: var(--bg-surface);
		border-color: var(--border-strong);
		transform: translateY(-1px);
	}

	.league-list-card.is-recommendation {
		border-style: dashed;
		opacity: 0.85;
	}

	/* 56 px square, 10 px radius, per-league-accent-tinted gradient +
	   30 % accent border. The diagonal sheen pseudo adds a soft gloss
	   so a flat colour fill doesn't read as a placeholder; the serif-
	   italic emblem sits above the sheen at z-index 2 so the gloss
	   never washes it out. */
	.league-logo {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 56px;
		height: 56px;
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
		background: var(--accent-grad);
	}

	.league-logo::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			120deg,
			transparent 35%,
			rgba(242, 236, 220, 0.1) 50%,
			transparent 65%
		);
		border-radius: inherit;
		pointer-events: none;
	}

	.league-logo .emblem {
		position: relative;
		z-index: 2;
		font-family: var(--font-serif, var(--font-display, serif));
		font-style: italic;
		font-size: 24px;
		font-weight: 500;
		color: var(--accent);
		line-height: 1;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.head {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.name {
		font-size: 15px;
		font-weight: 600;
		letter-spacing: -0.005em;
		color: var(--text-base);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	/* Role chip explicitly references `--laurel` (NOT `--accent`):
	   the outer button overrides `--accent` to the per-league colour
	   for the logo tile gradient, so a bare `var(--accent)` here
	   would tint owner / admin chips with the league's accent
	   (sage / red / etc.) instead of the global laurel. */
	.role-chip {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		padding: 2px 7px;
		border-radius: var(--r-4);
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.1em;
		background: rgba(226, 184, 66, 0.14);
		color: var(--laurel);
	}

	.role-chip[data-role='owner'] {
		background: rgba(226, 184, 66, 0.14);
		color: var(--laurel);
	}

	.role-chip.is-recommendation {
		background: rgba(79, 211, 161, 0.12);
		color: var(--yes);
	}

	.meta {
		font-size: 10.5px;
		color: var(--text-muted);
		letter-spacing: var(--tracking-wide);
	}

	.friend-overlap {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 2px;
	}

	.friend-avatars {
		display: flex;
		align-items: center;
	}

	.friend-avatar-dot {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		outline: 1.5px solid var(--bg-popover);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-primary) 65%, transparent),
			color-mix(in srgb, var(--accent) 55%, transparent)
		);
		margin-left: -6px;
	}

	.friend-avatar-dot:first-child {
		margin-left: 0;
	}

	.friend-overlap-text {
		font-size: var(--t-10);
		color: var(--text-muted);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.friend-overlap-handle {
		color: var(--laurel);
		font-weight: 700;
	}

	.friend-overlap-suffix {
		margin-left: 0.2rem;
	}

	.activity-preview {
		margin-top: 2px;
		font-size: 10.5px;
		color: var(--text-muted);
		line-height: 1.3;
	}

	.trailing {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 6px;
		flex-shrink: 0;
		color: var(--text-muted);
	}

	/* Tiny laurel-tinted chip in mono with a 4 px radius.
	   `--laurel` (NOT `--accent`) for the same reason as `.role-chip`
	   above: the outer button overrides `--accent` to the league's
	   per-card colour for the logo tile gradient, and a bare
	   `var(--accent)` here would tint the copy pill with that per-
	   league colour instead of the global laurel. */
	.copy-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 3px 6px;
		border-radius: var(--r-4);
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--laurel);
		background: rgba(226, 184, 66, 0.06);
		border: 1px solid rgba(226, 184, 66, 0.22);
		cursor: pointer;
		user-select: none;
		transition: background-color 160ms var(--ease-vici);
	}

	.copy-pill:hover {
		background: rgba(226, 184, 66, 0.14);
	}

	.copy-pill.is-copied {
		color: var(--laurel);
	}
</style>
