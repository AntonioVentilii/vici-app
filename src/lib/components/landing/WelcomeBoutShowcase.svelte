<script lang="ts">
	import { ChevronRight } from 'lucide-svelte/icons';
	import {
		WELCOME_BOUT_SHOWCASE,
		type WelcomeBoutLeague
	} from '$lib/constants/welcome-social-panels.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { formatLocalePercent as formatAccuracy } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Panel 02 — Active Bout. Head-to-head between two mock leagues with
	 * a VS divider, day counter, and a relative-accuracy bar. Mirrors
	 * the prototype's `<BoutShowcase>` in landing.jsx:981.
	 */
	const bout = WELCOME_BOUT_SHOWCASE;
	const leading: 'left' | 'right' = bout.left.accuracy >= bout.right.accuracy ? 'left' : 'right';
	const leftPct = bout.left.accuracy * 100;
	const rightPct = bout.right.accuracy * 100;
	const leftBarWidth = (leftPct / (leftPct + rightPct)) * 100;
	const rightBarWidth = (rightPct / (leftPct + rightPct)) * 100;

	const accuracyClass = ({
		side
	}: {
		side: 'left' | 'right';
	}): 'welcome-bout-acc welcome-bout-acc--leading' | 'welcome-bout-acc' =>
		side === leading ? 'welcome-bout-acc welcome-bout-acc--leading' : 'welcome-bout-acc';

	interface LeagueSide {
		league: WelcomeBoutLeague;
		side: 'left' | 'right';
	}
	const rows: readonly LeagueSide[] = [
		{ league: bout.left, side: 'left' },
		{ league: bout.right, side: 'right' }
	];
</script>

<article class="welcome-panel welcome-panel--bout">
	<header class="welcome-panel-head">
		<span class="eyebrow welcome-panel-eyebrow welcome-bout-eyebrow">
			{t({ locale: $localeStore, key: 'social.b_eyebrow' })}
		</span>
		<span class="welcome-bout-day">
			{t({
				locale: $localeStore,
				key: 'social.b_day',
				params: { n: bout.day, total: bout.totalDays }
			})}
		</span>
	</header>

	<h3 class="welcome-panel-title">
		{t({ locale: $localeStore, key: 'social.b_title_a' })}
		<span class="serif-italic acc">{t({ locale: $localeStore, key: 'social.b_title_b' })}</span>
	</h3>
	<p class="welcome-panel-sub">{t({ locale: $localeStore, key: 'social.b_sub' })}</p>

	<div class="welcome-bout-card">
		{#each rows as row, idx (row.league.name)}
			<div class="welcome-bout-row">
				<div class="welcome-bout-brand">
					<span style:background={row.league.color} class="welcome-bout-emblem">
						{row.league.emblem}
					</span>
					<div class="welcome-bout-brand-text">
						<span class="welcome-bout-name">{row.league.name}</span>
						<span class="num welcome-bout-meta">
							{t({
								locale: $localeStore,
								key: 'social.l_members',
								params: { count: row.league.memberCount }
							})}
						</span>
					</div>
				</div>
				<span class={accuracyClass({ side: row.side })}>
					{formatAccuracy({ value: row.league.accuracy, locale: $localeStore })}
				</span>
			</div>

			{#if idx === 0}
				<div class="welcome-bout-vs" aria-hidden="true">
					<span class="welcome-bout-vs-line"></span>
					<span class="serif-italic welcome-bout-vs-label">
						{t({ locale: $localeStore, key: 'social.b_vs' })}
					</span>
					<span class="welcome-bout-vs-line"></span>
				</div>
			{/if}
		{/each}

		<div class="welcome-bout-bar" aria-hidden="true">
			<span
				style:width={`${leftBarWidth}%`}
				style:--bar-color={bout.left.color}
				class="welcome-bout-bar-left"
			></span>
			<span
				style:width={`${rightBarWidth}%`}
				style:--bar-color={bout.right.color}
				class="welcome-bout-bar-right"
			></span>
		</div>
	</div>

	<a class="welcome-panel-cta" href="#bouts">
		{t({ locale: $localeStore, key: 'social.b_cta' })}
		<ChevronRight aria-hidden="true" size={14} />
	</a>
</article>

<style lang="postcss">
	.welcome-panel--bout {
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--terracotta) 8%, transparent),
			color-mix(in srgb, var(--terracotta) 2%, transparent) 60%,
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

	.welcome-bout-eyebrow {
		color: var(--terracotta);
	}

	.welcome-bout-day {
		padding: 0.125rem 0.5rem;
		border: 1px solid color-mix(in srgb, var(--terracotta) 30%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--terracotta) 14%, transparent);
		color: var(--terracotta);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
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

	.welcome-bout-card {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		margin-top: 1.375rem;
		padding: 1.125rem 1.125rem 1.375rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: color-mix(in srgb, var(--foreground) 6%, transparent);
	}

	.welcome-bout-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.welcome-bout-brand {
		display: inline-flex;
		align-items: center;
		gap: 0.625rem;
		min-width: 0;
		flex: 1;
	}

	.welcome-bout-emblem {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.875rem;
		height: 1.875rem;
		flex: 0 0 auto;
		border-radius: 8px;
		color: var(--ink);
		font-family: var(--font-serif);
		font-size: 1rem;
		font-style: italic;
		font-weight: 400;
		line-height: 1;
	}

	.welcome-bout-brand-text {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.welcome-bout-name {
		overflow: hidden;
		color: var(--foreground);
		font-size: var(--t-13);
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.welcome-bout-meta {
		color: var(--muted-foreground);
		font-size: 10px;
		letter-spacing: 0.08em;
	}

	.welcome-bout-acc {
		flex-shrink: 0;
		color: var(--foreground);
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.welcome-bout-acc--leading {
		color: var(--color-accent);
	}

	.welcome-bout-vs {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.welcome-bout-vs-line {
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	.welcome-bout-vs-label {
		padding: 0 0.125rem;
		color: var(--muted-foreground);
		font-size: 1rem;
		font-weight: 400;
		letter-spacing: 0.04em;
		line-height: 1;
	}

	.welcome-bout-bar {
		display: flex;
		height: 0.375rem;
		margin-top: 0.375rem;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--foreground) 14%, transparent);
	}

	.welcome-bout-bar-left,
	.welcome-bout-bar-right {
		height: 100%;
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--bar-color) 45%, transparent),
			var(--bar-color)
		);
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
