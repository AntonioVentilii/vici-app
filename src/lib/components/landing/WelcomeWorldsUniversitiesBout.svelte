<script lang="ts">
	import { ChevronRight } from 'lucide-svelte/icons';
	import {
		WELCOME_UNIVERSITIES_PODIUM,
		WELCOME_UNIVERSITIES_TOTAL,
		type WelcomeUniversityMock
	} from '$lib/constants/welcome-social-panels.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { formatLocalePercent as formatAccuracy } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Panel 03 — Worlds Universities. Top-3 podium for the World Cup
	 * universities bout. Silver / gold / bronze order (gold centred +
	 * taller). Mirrors the prototype's `<WorldsUniversitiesBout>` in
	 * landing.jsx:1097.
	 */
	interface PodiumEntry {
		readonly school: WelcomeUniversityMock;
		readonly rank: 1 | 2 | 3;
		readonly height: number;
	}

	const sorted = [...WELCOME_UNIVERSITIES_PODIUM].sort((a, b) => b.accuracy - a.accuracy);
	const podium: readonly PodiumEntry[] = [
		{ school: sorted[1], rank: 2, height: 84 },
		{ school: sorted[0], rank: 1, height: 110 },
		{ school: sorted[2], rank: 3, height: 70 }
	].filter((entry): entry is PodiumEntry => entry.school !== undefined);
</script>

<article class="welcome-panel welcome-panel--worlds">
	<header class="welcome-panel-head">
		<span class="eyebrow welcome-panel-eyebrow welcome-worlds-eyebrow">
			{t({ locale: $localeStore, key: 'social.w_eyebrow' })}
		</span>
		<span class="welcome-worlds-tag">{t({ locale: $localeStore, key: 'social.wcbout_tag' })}</span>
	</header>

	<h3 class="welcome-panel-title">
		{t({ locale: $localeStore, key: 'social.wcbout_title_a' })}
		<span class="serif-italic acc">
			{t({ locale: $localeStore, key: 'social.wcbout_title_b' })}
		</span>
	</h3>
	<p class="welcome-panel-sub">
		{t({
			locale: $localeStore,
			key: 'social.wcbout_sub',
			params: { count: WELCOME_UNIVERSITIES_TOTAL }
		})}
	</p>

	<div class="welcome-worlds-podium">
		{#each podium as entry (entry.school.id)}
			<div class="welcome-worlds-col">
				<div
					style:background={entry.school.color}
					style:color={entry.school.text}
					class="welcome-worlds-disc"
					class:is-gold={entry.rank === 1}
				>
					{entry.school.short.charAt(0)}
				</div>
				<div
					style:height={`${entry.height}px`}
					class="welcome-worlds-bar"
					class:is-gold={entry.rank === 1}
				>
					<span class="num welcome-worlds-rank" class:is-gold={entry.rank === 1}>
						#{entry.rank}
					</span>
					<span class="num welcome-worlds-name">{entry.school.short}</span>
					<span class="num welcome-worlds-acc" class:is-gold={entry.rank === 1}>
						{formatAccuracy({ value: entry.school.accuracy, locale: $localeStore })}
					</span>
				</div>
			</div>
		{/each}
	</div>

	<a class="welcome-panel-cta" href="#bouts">
		{t({ locale: $localeStore, key: 'social.wcbout_cta' })}
		<ChevronRight aria-hidden="true" size={14} />
	</a>
</article>

<style lang="postcss">
	.welcome-panel--worlds {
		background: linear-gradient(
			180deg,
			color-mix(in srgb, #b49cff 10%, transparent),
			color-mix(in srgb, #b49cff 2%, transparent) 70%,
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

	.welcome-worlds-eyebrow {
		color: #b49cff;
	}

	.welcome-worlds-tag {
		padding: 0.125rem 0.5rem;
		border: 1px solid color-mix(in srgb, #b49cff 30%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, #b49cff 14%, transparent);
		color: #b49cff;
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

	.welcome-worlds-podium {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.5rem;
		align-items: end;
		margin: 1.125rem 0 0.375rem;
	}

	.welcome-worlds-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.welcome-worlds-disc {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border: 2px solid var(--border);
		border-radius: 999px;
		font-family: var(--font-serif);
		font-size: 1.25rem;
		font-style: italic;
		font-weight: 400;
		line-height: 1;
	}

	.welcome-worlds-disc.is-gold {
		border-color: var(--color-accent);
		box-shadow: 0 4px 16px -4px color-mix(in srgb, var(--laurel) 50%, transparent);
	}

	.welcome-worlds-bar {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		width: 100%;
		padding: 0.625rem 0.375rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: color-mix(in srgb, var(--foreground) 4%, transparent);
		text-align: center;
	}

	.welcome-worlds-bar.is-gold {
		border-color: color-mix(in srgb, var(--laurel) 30%, transparent);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--laurel) 18%, transparent),
			color-mix(in srgb, var(--laurel) 4%, transparent)
		);
	}

	.welcome-worlds-rank {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.welcome-worlds-rank.is-gold {
		color: var(--color-accent);
	}

	.welcome-worlds-name {
		margin-top: 0.25rem;
		overflow: hidden;
		max-width: 100%;
		color: var(--foreground);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.welcome-worlds-acc {
		margin-top: auto;
		color: var(--foreground);
		font-size: 13px;
		font-weight: 700;
	}

	.welcome-worlds-acc.is-gold {
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
