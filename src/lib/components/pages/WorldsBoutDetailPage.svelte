<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { VXP_WORLDS_PODIUM } from '$lib/constants/vxp-economy.constants';
	import {
		WORLDS_COUNTRIES,
		WORLDS_UNIVERSITIES
	} from '$lib/constants/worlds-affiliations.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { AffiliationKind } from '$lib/types/affiliation';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Worlds bout — the leaderboard view across every affiliation of
	 * a given kind (all schools or all countries). Drill-in from
	 * `WorldsPage` podium / leaderboard CTAs.
	 *
	 * Per-affiliation accuracy + ranks await the aggregation backend
	 * (same gap the per-affiliation detail page calls out). Until
	 * that lands, the page renders the roster + podium prizes + a
	 * "stats pending" hint so the layout is faithful without faking
	 * the standings.
	 */
	interface Props {
		kind: AffiliationKind;
	}

	const { kind }: Props = $props();

	const roster = $derived(kind === 'university' ? WORLDS_UNIVERSITIES : WORLDS_COUNTRIES);

	const titleKey = $derived<MessageKey>(
		kind === 'university' ? 'worlds.bout.title_university' : 'worlds.bout.title_country'
	);

	const detailPath = (id: string): string => {
		const segment = kind === 'university' ? 'school' : 'country';

		return `${resolve(AppPath.Social)}/worlds/${segment}/${id}`;
	};
</script>

<div class="worlds-bout">
	<MobileAppBar
		align="left"
		back={{
			label: t({ locale: $localeStore, key: 'worlds.bout.back' }),
			onBack: () => void goto(`${resolve(AppPath.Social)}/worlds`)
		}}
		title={t({ locale: $localeStore, key: titleKey })}
	/>

	<section class="worlds-bout-podium" aria-label="Worlds podium prizes">
		<h2 class="eyebrow worlds-bout-section-eyebrow">
			{t({ locale: $localeStore, key: 'worlds.podium.eyebrow' })}
		</h2>
		<div class="worlds-bout-podium-grid">
			<div class="worlds-bout-podium-rung is-gold">
				<span class="allcaps">{t({ locale: $localeStore, key: 'worlds.podium.gold' })}</span>
				<span class="num">+{VXP_WORLDS_PODIUM.gold}</span>
			</div>
			<div class="worlds-bout-podium-rung is-silver">
				<span class="allcaps">{t({ locale: $localeStore, key: 'worlds.podium.silver' })}</span>
				<span class="num">+{VXP_WORLDS_PODIUM.silver}</span>
			</div>
			<div class="worlds-bout-podium-rung is-bronze">
				<span class="allcaps">{t({ locale: $localeStore, key: 'worlds.podium.bronze' })}</span>
				<span class="num">+{VXP_WORLDS_PODIUM.bronze}</span>
			</div>
		</div>
	</section>

	<section class="worlds-bout-section">
		<h2 class="eyebrow worlds-bout-section-eyebrow">
			{t({
				locale: $localeStore,
				key: 'worlds.bout.list_eyebrow',
				params: { count: roster.length }
			})}
		</h2>
		<p class="worlds-bout-pending">
			{t({ locale: $localeStore, key: 'worlds.detail.stats_pending' })}
		</p>
		<ul class="worlds-bout-list">
			{#each roster as option (option.id)}
				<li>
					<a class="worlds-bout-row" href={detailPath(option.id)}>
						<span class="worlds-bout-glyph" aria-hidden="true">{option.glyph}</span>
						<span class="worlds-bout-name">{option.name}</span>
						<span aria-hidden="true">→</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
</div>

<style lang="postcss">
	.worlds-bout {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0 1.25rem 6rem;
	}

	.worlds-bout-podium {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.85rem 0.9rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.worlds-bout-section-eyebrow {
		margin: 0;
		color: var(--text-muted);
	}

	.worlds-bout-podium-grid {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.5rem;
	}

	.worlds-bout-podium-rung {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		padding: 0.55rem 0.45rem;
		border-radius: var(--r-12);
		border: 1px solid var(--border-base);
		background: color-mix(in srgb, var(--bg-surface) 94%, transparent);
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.worlds-bout-podium-rung .num {
		font-size: var(--t-16, 1rem);
		font-weight: 700;
		color: var(--text-base);
	}

	.worlds-bout-podium-rung.is-gold {
		border-color: color-mix(in srgb, #f4c544 50%, var(--border-base));
		background: color-mix(in srgb, #f4c544 8%, var(--bg-surface));
	}

	.worlds-bout-podium-rung.is-silver {
		border-color: color-mix(in srgb, #c0c5cc 50%, var(--border-base));
		background: color-mix(in srgb, #c0c5cc 8%, var(--bg-surface));
	}

	.worlds-bout-podium-rung.is-bronze {
		border-color: color-mix(in srgb, #c97c4a 50%, var(--border-base));
		background: color-mix(in srgb, #c97c4a 8%, var(--bg-surface));
	}

	.worlds-bout-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.worlds-bout-pending {
		margin: 0;
		padding: 0.7rem 0.85rem;
		font-size: var(--t-12);
		line-height: 1.5;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px dashed var(--border-base);
		border-radius: var(--r-12);
	}

	.worlds-bout-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.worlds-bout-row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem 0.95rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		color: var(--text-base);
		text-decoration: none;
		transition: background 140ms ease;
	}

	.worlds-bout-row:hover {
		background: color-mix(in srgb, var(--laurel) 8%, var(--bg-surface));
	}

	.worlds-bout-glyph {
		font-size: 1.25rem;
		min-width: 36px;
		text-align: center;
		font-weight: 700;
	}

	.worlds-bout-name {
		flex: 1;
		font-size: var(--t-14);
		font-weight: 500;
	}
</style>
