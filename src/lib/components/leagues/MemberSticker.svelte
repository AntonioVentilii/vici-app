<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import { profilesStore } from '$lib/stores/profiles.store';
	import type { LeagueMemberRole } from '$lib/types/league-member';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * League roster tile — small portrait-style card with the
	 * member's rank slot, deterministic gradient avatar, handle, and
	 * role chip. Grid-friendly (3-up at the standard mobile width).
	 *
	 * The avatar gradient is derived from the principal text so the
	 * same member always lands on the same colour pair, without
	 * needing a per-member skin field on the satellite.
	 */
	interface Props {
		/** Member's principal text — used for avatar gradient seed +
		 *  profile lookup. */
		principal: string;
		/** Membership role; drives the chip + accent border. */
		role: LeagueMemberRole;
		/** 1-indexed roster position. Rendered as `N°{NN}`. */
		rank: number;
		/** Marks the caller's own row — adds a `YOU` chip + accent
		 *  border. */
		isSelf?: boolean;
		/** Accent colour to tint the gradient against. Defaults to
		 *  `--laurel`. */
		accentColor?: string;
	}

	const { principal, role, rank, isSelf = false, accentColor }: Props = $props();

	const accent = $derived(accentColor ?? '#7e9b6a');

	// Deterministic per-principal gradient. We bucket the principal
	// text into a Panini-style palette so repeat visits land on the
	// same swatch.
	const PALETTE = [
		['#9C6E45', '#6E4A2A'],
		['#A78657', '#7A5E37'],
		['#B98968', '#86603F'],
		['#6E4A2A', '#4A2F18'],
		['#C99F75', '#9C7250'],
		['#7E5638', '#553820']
	] as const;

	const seed = $derived.by(() => {
		let h = 0;

		for (let i = 0; i < principal.length; i++) {
			h = (h * 31 + principal.charCodeAt(i)) >>> 0;
		}

		return h % PALETTE.length;
	});

	const swatch = $derived(PALETTE[seed]);

	const handle = $derived.by(() => {
		const profile = $profilesStore.get(principal);

		if (profile?.nickname && profile.nickname.length > 0) {
			return `@${profile.nickname}`;
		}

		return principal.length > 12 ? `${principal.slice(0, 5)}…${principal.slice(-5)}` : principal;
	});

	const initials = $derived.by(() => {
		const profile = $profilesStore.get(principal);

		if (profile?.nickname && profile.nickname.length > 0) {
			return profile.nickname.slice(0, 2).toUpperCase();
		}

		return principal.slice(0, 2).toUpperCase();
	});

	const roleLabelKey: MessageKey = $derived(
		role === 'owner'
			? 'leagues.role.owner'
			: role === 'admin'
				? 'leagues.role.admin'
				: 'leagues.role.member'
	);

	const tone = $derived.by(() => {
		if (isSelf) {
			return 'you';
		}

		if (role === 'owner') {
			return 'gold';
		}

		if (role === 'admin') {
			return 'silver';
		}

		return 'bronze';
	});
</script>

<div
	style:--accent={accent}
	style:--swatch-base={swatch[0]}
	style:--swatch-shadow={swatch[1]}
	class="member-sticker"
	data-tone={tone}
>
	<div class="member-sticker-portrait" aria-hidden="true">
		<span class="member-sticker-initials">{initials}</span>
		<span class="member-sticker-rank num" data-tone={tone}>
			N°{String(rank).padStart(2, '0')}
		</span>
	</div>
	<div class="member-sticker-foot">
		<span class="member-sticker-name">{handle}</span>
		<span class="member-sticker-role allcaps" data-role={role}>
			{#if isSelf}
				{t({ locale: $localeStore, key: 'leagues.detail.you_chip' })}
			{:else}
				{t({ locale: $localeStore, key: roleLabelKey })}
			{/if}
		</span>
	</div>
</div>

<style lang="postcss">
	.member-sticker {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		aspect-ratio: 3 / 4;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		box-shadow: 0 6px 14px -10px rgba(0, 0, 0, 0.45);
		isolation: isolate;
		transition:
			transform 220ms var(--ease-vici),
			border-color 220ms var(--ease-vici);
	}

	.member-sticker:hover {
		transform: translateY(-2px);
	}

	.member-sticker[data-tone='you'] {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border-base));
	}

	.member-sticker[data-tone='gold'] {
		border-color: color-mix(in srgb, var(--laurel) 50%, var(--border-base));
	}

	.member-sticker[data-tone='silver'] {
		border-color: color-mix(in srgb, var(--text-muted) 35%, var(--border-base));
	}

	.member-sticker-portrait {
		position: relative;
		aspect-ratio: 1 / 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--swatch-base), var(--swatch-shadow));
		overflow: hidden;
	}

	.member-sticker-portrait::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			120deg,
			transparent 35%,
			color-mix(in srgb, var(--accent) 18%, transparent) 50%,
			transparent 65%
		);
		pointer-events: none;
	}

	.member-sticker-initials {
		font-family: var(--font-display);
		font-size: var(--t-24);
		font-weight: 700;
		letter-spacing: var(--tracking-snug);
		color: var(--text-on-accent, #fff);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
		z-index: 1;
	}

	.member-sticker-rank {
		position: absolute;
		top: 4px;
		right: 4px;
		z-index: 2;
		padding: 0.1rem 0.35rem;
		font-size: 0.55rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		color: var(--ink, #1a1410);
		background: var(--accent);
		border-radius: var(--r-2);
	}

	.member-sticker-rank[data-tone='silver'] {
		background: #c0c5cb;
	}

	.member-sticker-rank[data-tone='bronze'] {
		background: #b57c52;
	}

	.member-sticker-foot {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.45rem 0.55rem 0.55rem;
		border-top: 1px solid var(--border-base);
		background: color-mix(in srgb, var(--bg-surface) 80%, transparent);
	}

	.member-sticker-name {
		font-size: var(--t-11);
		font-weight: 600;
		letter-spacing: -0.005em;
		color: var(--text-base);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.member-sticker-role {
		font-size: 0.55rem;
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
	}

	.member-sticker-role[data-role='owner'] {
		color: var(--laurel);
	}
</style>
