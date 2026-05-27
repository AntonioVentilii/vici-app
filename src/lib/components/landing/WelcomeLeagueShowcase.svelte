<script lang="ts">
	import { ChevronRight } from 'lucide-svelte/icons';
	import { WELCOME_LEAGUE_SHOWCASE } from '$lib/constants/welcome-social-panels.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { formatLocalePercent as formatAccuracy } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Panel 01 — Your League. Mini league leaderboard mock (Office Hex)
	 * showing the top 3 + the user's row highlighted. Mirrors the
	 * prototype's `<LeagueShowcase>` in landing.jsx:871.
	 */
	const league = WELCOME_LEAGUE_SHOWCASE;
</script>

<article class="welcome-panel welcome-panel--league">
	<header class="welcome-panel-head">
		<span class="eyebrow acc welcome-panel-eyebrow">
			{t({ locale: $localeStore, key: 'social.l_eyebrow' })}
		</span>
	</header>

	<h3 class="welcome-panel-title">
		{t({ locale: $localeStore, key: 'social.l_title_a' })}
		<span class="serif-italic acc">{t({ locale: $localeStore, key: 'social.l_title_b' })}</span>
	</h3>
	<p class="welcome-panel-sub">{t({ locale: $localeStore, key: 'social.l_sub' })}</p>

	<div class="welcome-league-card">
		<div style:--league-color={league.color} class="welcome-league-header">
			<div class="welcome-league-brand">
				<span style:background={league.color} class="welcome-league-emblem">{league.emblem}</span>
				<span class="welcome-league-name">{league.name}</span>
			</div>
			<span class="num welcome-league-meta">
				{t({
					locale: $localeStore,
					key: 'social.l_members',
					params: { count: league.memberCount }
				})}
			</span>
		</div>

		<ul class="welcome-league-rows">
			{#each league.members as member, idx (member.handle)}
				{@const isYou = member.kind === 'you'}
				{@const isGold = member.kind === 'gold'}
				<li
					class="welcome-league-row"
					class:is-divider={idx === 3}
					class:is-first={idx === 0}
					class:is-you={isYou}
				>
					<span class="num welcome-league-rank" class:is-top={member.rank <= 3 || isYou}>
						#{member.rank}
					</span>
					<span class="welcome-league-handle">
						<span style:background={member.shirt} class="welcome-league-avatar" aria-hidden="true">
							{member.handle.charAt(0).toUpperCase()}
						</span>
						<span class="welcome-league-name-row">
							@{member.handle}{#if isYou}<span class="eyebrow welcome-league-you-suffix">
									· {t({ locale: $localeStore, key: 'social.l_you' })}
								</span>{/if}
						</span>
					</span>
					<span class="num welcome-league-accuracy" class:is-gold={isGold} class:is-you={isYou}>
						{formatAccuracy({ value: member.accuracy, locale: $localeStore })}
					</span>
				</li>
			{/each}
		</ul>
	</div>

	<a class="welcome-panel-cta" href="#leagues">
		{t({ locale: $localeStore, key: 'social.l_cta' })}
		<ChevronRight aria-hidden="true" size={14} />
	</a>
</article>

<style lang="postcss">
	.welcome-panel--league {
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--laurel) 8%, transparent),
			color-mix(in srgb, var(--laurel) 2%, transparent) 60%,
			transparent
		);
	}

	.welcome-panel {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 1.25rem;
		border: 1px solid var(--border);
		border-radius: 18px;
		background-color: var(--card);
		box-shadow: var(--shadow-card);
		position: relative;
		overflow: hidden;
	}

	.welcome-panel-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.welcome-panel-eyebrow {
		letter-spacing: 0.12em;
	}

	.welcome-panel-title {
		margin: 0.25rem 0 0;
		color: var(--foreground);
		font-size: clamp(1.25rem, 2.2vw, 1.5rem);
		font-weight: 700;
		line-height: 1.15;
		letter-spacing: -0.015em;
	}

	.welcome-panel-sub {
		margin: 0.5rem 0 0;
		color: var(--muted-foreground);
		font-size: var(--t-13);
		line-height: 1.5;
	}

	.welcome-league-card {
		margin-top: 1.125rem;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: color-mix(in srgb, var(--foreground) 6%, transparent);
	}

	.welcome-league-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 0.875rem;
		border-bottom: 1px solid var(--border);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--league-color) 18%, transparent),
			transparent
		);
	}

	.welcome-league-brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.welcome-league-emblem {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		flex: 0 0 auto;
		border-radius: 6px;
		color: var(--ink);
		font-family: var(--font-serif);
		font-size: 0.75rem;
		font-style: italic;
		font-weight: 400;
		line-height: 1;
	}

	.welcome-league-name {
		overflow: hidden;
		color: var(--foreground);
		font-size: var(--t-13);
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.welcome-league-meta {
		flex-shrink: 0;
		color: var(--muted-foreground);
		font-size: 11px;
		letter-spacing: 0.1em;
	}

	.welcome-league-rows {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.welcome-league-row {
		display: grid;
		grid-template-columns: 1.625rem 1fr auto;
		gap: 0.625rem;
		align-items: center;
		padding: 0.5rem 0.875rem;
		border-top: 1px solid var(--border);
	}

	.welcome-league-row.is-first {
		border-top: none;
	}

	.welcome-league-row.is-divider {
		border-top: 1px dashed color-mix(in srgb, var(--foreground) 25%, transparent);
	}

	.welcome-league-row.is-you {
		background: color-mix(in srgb, var(--laurel) 6%, transparent);
	}

	.welcome-league-rank {
		color: var(--muted-foreground);
		font-size: 12px;
		font-weight: 500;
	}

	.welcome-league-rank.is-top {
		color: var(--foreground);
		font-weight: 700;
	}

	.welcome-league-row.is-you .welcome-league-rank {
		color: var(--color-accent);
	}

	.welcome-league-handle {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.welcome-league-avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		flex: 0 0 auto;
		border: 1.5px solid var(--background);
		border-radius: 999px;
		color: var(--ink);
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.welcome-league-name-row {
		overflow: hidden;
		color: var(--foreground);
		font-size: var(--t-13);
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.welcome-league-row.is-you .welcome-league-name-row {
		color: var(--color-accent);
	}

	.welcome-league-you-suffix {
		margin-left: 0.25rem;
		color: var(--muted-foreground);
		letter-spacing: 0.08em;
	}

	.welcome-league-accuracy {
		color: var(--foreground);
		font-size: 12px;
		font-weight: 700;
	}

	.welcome-league-accuracy.is-gold,
	.welcome-league-accuracy.is-you {
		color: var(--color-accent);
	}

	.welcome-panel-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		margin-top: auto;
		padding-top: 1rem;
		color: var(--color-accent);
		font-size: var(--t-14);
		font-weight: 600;
		text-decoration: none;
	}

	.welcome-panel-cta:hover {
		color: var(--laurel-deep);
	}
</style>
