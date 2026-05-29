<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { VXP_WORLDS_PODIUM } from '$lib/constants/vxp-economy.constants';
	import {
		lookupWorldsAffiliation,
		WORLDS_COUNTRIES,
		WORLDS_UNIVERSITIES
	} from '$lib/constants/worlds-affiliations.constants';
	import { daysToFinal } from '$lib/derived/featured-event.derived';
	import { listAffiliationStats, listMyAffiliations } from '$lib/services/worlds.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { AffiliationDoc, AffiliationKind } from '$lib/types/affiliation';
	import type { AffiliationStatsDoc } from '$lib/types/affiliation-stats';
	import {
		affiliationLifetimeAccuracy,
		affiliationMonthlyAccuracy,
		formatAccuracyPercent
	} from '$lib/utils/affiliation-stats.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { goBack } from '$lib/utils/nav.utils';

	/**
	 * Worlds bout — the full leaderboard surface across every
	 * affiliation of a given `kind` (`university` or `country`).
	 *
	 * Layers in order:
	 *
	 *  1. Hero card — `FIFA WORLD CUP · Live` tags, surface-aware title
	 *     (`Worlds Universities/Countries World Cup Bout` or
	 *     `… May Season Bout`), days-left + roster size meta.
	 *
	 *  2. Scope toggle — `May Season` vs `WC Bout`. Lets users pivot
	 *     between the lifetime / monthly ranking on the same screen.
	 *     Initial scope reads from the `?scope=` query param so deep
	 *     links from `BoutsInboxPage` land on the correct view.
	 *
	 *  3. Full ranked leaderboard — top 10 collapsed, "See all" expands
	 *     to the full roster. When the caller is affiliated and outside
	 *     the visible window, a sticky `is-you` row pins to the bottom.
	 *
	 *  4. Podium prizes — the fixed VXP payouts from `VXP_WORLDS_PODIUM`
	 *     surface as an eyebrow card at the bottom so users learn what
	 *     they're playing for.
	 *
	 * Roster ordering is driven off `listAffiliationStats`.
	 * Affiliations without a stats doc (no resolved calls yet) don't
	 * appear in the ranked list — the affiliation detail page is the
	 * place to land before your first call resolves.
	 */
	interface Props {
		kind: AffiliationKind;
	}

	const { kind }: Props = $props();

	type Scope = 'wc' | 'month';

	const VISIBLE_PREVIEW = 10;

	const roster = $derived(kind === 'university' ? WORLDS_UNIVERSITIES : WORLDS_COUNTRIES);

	const titleKey = $derived<MessageKey>(
		kind === 'university' ? 'worlds.bout.title_university' : 'worlds.bout.title_country'
	);

	const surfaceLabelLedeKey = $derived<MessageKey>(
		kind === 'university' ? 'bouts.uni.wc_title_lede' : 'bouts.country.wc_title_lede'
	);

	let stats = $state<AffiliationStatsDoc[]>([]);
	let myAffil = $state<AffiliationDoc | undefined>();
	let loadState = $state<'loading' | 'ready' | 'error'>('loading');
	let expanded = $state(false);

	// Initial scope is sourced off `?scope=month` (the BoutsInbox monthly
	// card link) — defaults to `wc` otherwise.
	let scope = $state<Scope>(page.url.searchParams.get('scope') === 'month' ? 'month' : 'wc');

	onMount(async () => {
		try {
			const [statsResp, affils] = await Promise.all([
				listAffiliationStats({ kind }),
				listMyAffiliations()
			]);
			stats = statsResp;
			myAffil = kind === 'university' ? affils.university : affils.country;
			loadState = 'ready';
		} catch {
			loadState = 'error';
		}
	});

	const accForScope = ({ row, scope: sc }: { row: AffiliationStatsDoc; scope: Scope }): number =>
		sc === 'wc' ? affiliationLifetimeAccuracy(row) : affiliationMonthlyAccuracy(row);

	const sortedForScope = $derived.by(() => {
		const list = [...stats];

		list.sort((a, b) => {
			const da = accForScope({ row: a, scope });
			const db = accForScope({ row: b, scope });

			if (da !== db) {
				return db - da;
			}

			if (a.totalCalls !== b.totalCalls) {
				return b.totalCalls - a.totalCalls;
			}

			return a.affiliationIdentifier.localeCompare(b.affiliationIdentifier);
		});

		return list;
	});

	const visibleRows = $derived(
		expanded ? sortedForScope : sortedForScope.slice(0, VISIBLE_PREVIEW)
	);

	const myStatsRow = $derived.by(() => {
		const mine = myAffil;

		return mine
			? sortedForScope.find((s) => s.affiliationIdentifier === mine.affiliationIdentifier)
			: undefined;
	});

	const myRank = $derived.by(() => {
		const mine = myAffil;

		return mine
			? sortedForScope.findIndex((s) => s.affiliationIdentifier === mine.affiliationIdentifier) + 1
			: 0;
	});

	const isMyRowVisible = $derived.by(() => {
		const mine = myAffil;

		return mine
			? visibleRows.some((s) => s.affiliationIdentifier === mine.affiliationIdentifier)
			: false;
	});

	const optionFor = (id: string) => lookupWorldsAffiliation({ kind, id });

	const detailPath = (id: string): string => {
		const segment = kind === 'university' ? 'school' : 'country';

		return `${resolve(AppPath.Social)}/worlds/${segment}/${id}`;
	};

	const handleRowNav = (id: string) => {
		void goto(detailPath(id));
	};

	const eventDaysLeft = $derived($daysToFinal);
</script>

<div class="worlds-bout">
	<MobileAppBar
		align="left"
		back={{
			label: t({ locale: $localeStore, key: 'worlds.bout.back' }),
			onBack: () => goBack(`${resolve(AppPath.Social)}/worlds`)
		}}
		title={t({ locale: $localeStore, key: titleKey })}
	/>

	{#if loadState === 'loading'}
		<p class="worlds-bout-status" aria-busy="true">
			{t({ locale: $localeStore, key: 'worlds.loading' })}
		</p>
	{:else if loadState === 'error'}
		<p class="worlds-bout-error" role="alert">
			{t({ locale: $localeStore, key: 'worlds.error.generic' })}
		</p>
	{:else}
		<!-- Hero card: tags + surface-aware title + meta line -->
		<section class="worlds-bout-hero" data-scope={scope}>
			<div class="worlds-bout-hero-tags">
				{#if scope === 'wc'}
					<span class="worlds-tag is-wc">
						{t({ locale: $localeStore, key: 'worlds.event.tag_wc' })}
					</span>
					<span class="worlds-tag is-live">
						{t({ locale: $localeStore, key: 'worlds.event.tag_live' })}
					</span>
				{:else}
					<span class="worlds-tag is-monthly">
						{t({ locale: $localeStore, key: 'worlds.bout.tag_monthly' })}
					</span>
				{/if}
			</div>
			<h3 class="worlds-bout-hero-title">
				{t({ locale: $localeStore, key: surfaceLabelLedeKey })}
				<span class="serif-italic worlds-bout-hero-emph">
					{scope === 'wc'
						? t({ locale: $localeStore, key: 'worlds.event.title_emph' })
						: t({ locale: $localeStore, key: 'worlds.bout.month_emph' })}
				</span>
				{t({ locale: $localeStore, key: 'worlds.event.title_tail' })}
			</h3>
			<p class="worlds-bout-hero-meta num">
				{#if scope === 'wc' && eventDaysLeft !== null}
					{t({
						locale: $localeStore,
						key: 'worlds.event.meta',
						params: { days: eventDaysLeft, schools: roster.length }
					})}
				{:else if scope === 'wc'}
					{t({
						locale: $localeStore,
						key: 'worlds.event.meta_archived',
						params: { schools: roster.length }
					})}
				{:else}
					{t({
						locale: $localeStore,
						key: 'worlds.bout.meta_month',
						params: { count: roster.length }
					})}
				{/if}
			</p>
		</section>

		<!-- Scope toggle: WC vs Month -->
		<div class="worlds-bout-scope" aria-label="Bout scope" role="tablist">
			<button
				class:is-active={scope === 'month'}
				aria-selected={scope === 'month'}
				onclick={() => (scope = 'month')}
				role="tab"
				type="button"
			>
				{t({ locale: $localeStore, key: 'worlds.bout.scope_month' })}
			</button>
			<button
				class:is-active={scope === 'wc'}
				aria-selected={scope === 'wc'}
				onclick={() => (scope = 'wc')}
				role="tab"
				type="button"
			>
				{t({ locale: $localeStore, key: 'worlds.scope.wc' })}
			</button>
		</div>

		<!-- Full leaderboard -->
		<div class="worlds-bout-list">
			{#if visibleRows.length === 0}
				<p class="worlds-bout-empty">
					{t({ locale: $localeStore, key: 'worlds.bout.empty_ranked' })}
				</p>
			{:else}
				{#each visibleRows as row, i (row.affiliationIdentifier)}
					{@const option = optionFor(row.affiliationIdentifier)}
					{@const isYou = myAffil?.affiliationIdentifier === row.affiliationIdentifier}
					<button
						class="worlds-bout-row"
						class:is-you={isYou}
						class:rank-1={i === 0}
						class:rank-2={i === 1}
						class:rank-3={i === 2}
						onclick={() => handleRowNav(row.affiliationIdentifier)}
						type="button"
					>
						<span class="num worlds-bout-rank">{(i + 1).toString().padStart(2, '0')}</span>
						<span class="worlds-bout-glyph" aria-hidden="true">
							{kind === 'country'
								? (option?.glyph ?? '?')
								: (option?.name ?? row.affiliationIdentifier).charAt(0)}
						</span>
						<div class="worlds-bout-meta">
							<div class="worlds-bout-name">
								{option?.name ?? row.affiliationIdentifier}
								{#if isYou}
									·
									<span class="worlds-bout-you">
										{t({ locale: $localeStore, key: 'worlds.you.suffix' })}
									</span>
								{/if}
							</div>
							<span class="num worlds-bout-sub">
								{t({
									locale: $localeStore,
									key: 'worlds.row.calls',
									params: { calls: row.totalCalls }
								})}
							</span>
						</div>
						<span class="num worlds-bout-pct"
							>{formatAccuracyPercent(accForScope({ row, scope }))}</span
						>
					</button>
				{/each}
			{/if}

			{#if sortedForScope.length > VISIBLE_PREVIEW}
				<button class="worlds-bout-see-all" onclick={() => (expanded = !expanded)} type="button">
					{#if expanded}
						{t({ locale: $localeStore, key: 'worlds.bout.show_top' })}
					{:else}
						{t({
							locale: $localeStore,
							key:
								kind === 'university'
									? 'worlds.bout.see_all_schools'
									: 'worlds.bout.see_all_countries',
							params: { count: sortedForScope.length }
						})}
					{/if}
				</button>
			{/if}

			{#if myAffil && myStatsRow && !isMyRowVisible}
				{@const myOption = optionFor(myAffil.affiliationIdentifier)}
				<div class="worlds-bout-you-sticky" role="status">
					<span class="num worlds-bout-rank">
						{myRank.toString().padStart(2, '0')}
					</span>
					<span class="worlds-bout-glyph is-you" aria-hidden="true">
						{kind === 'country'
							? (myOption?.glyph ?? '?')
							: (myOption?.name ?? myAffil.affiliationIdentifier).charAt(0)}
					</span>
					<div class="worlds-bout-meta">
						<div class="worlds-bout-name worlds-bout-name-you">
							{myOption?.name ?? myAffil.affiliationIdentifier}
							·
							<span class="worlds-bout-you">
								{t({ locale: $localeStore, key: 'worlds.you.suffix' })}
							</span>
						</div>
						<span class="num worlds-bout-sub">
							{t({
								locale: $localeStore,
								key: 'worlds.row.calls',
								params: { calls: myStatsRow.totalCalls }
							})}
						</span>
					</div>
					<span class="num worlds-bout-pct worlds-bout-pct-you">
						{formatAccuracyPercent(accForScope({ row: myStatsRow, scope }))}
					</span>
				</div>
			{/if}
		</div>

		<!-- Podium prizes — fixed VXP payouts for the bout -->
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
	{/if}
</div>

<style lang="postcss">
	.worlds-bout {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0 1.25rem 6rem;
	}

	.worlds-bout-status,
	.worlds-bout-error {
		margin: 0;
		padding: 1rem;
		font-size: var(--t-13);
		border-radius: var(--r-12);
	}

	.worlds-bout-status {
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
	}

	.worlds-bout-error {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	/* Hero — surface-aware tint. WC scope uses the orange WC accent;
	   month scope uses the laurel tone. */
	.worlds-bout-hero {
		position: relative;
		overflow: hidden;
		padding: 0.9rem 1rem;
		background:
			linear-gradient(180deg, color-mix(in srgb, #ff6b2a 14%, transparent), transparent 70%),
			var(--bg-surface);
		border: 1px solid color-mix(in srgb, #ff6b2a 25%, var(--border-base));
		border-radius: var(--r-16, 1rem);
	}

	.worlds-bout-hero[data-scope='month'] {
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--laurel) 14%, transparent), transparent 70%),
			var(--bg-surface);
		border-color: color-mix(in srgb, var(--laurel) 25%, var(--border-base));
	}

	.worlds-bout-hero-tags {
		display: flex;
		gap: 0.35rem;
		margin-bottom: 0.55rem;
	}

	.worlds-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.18rem 0.45rem;
		font-family: var(--font-mono, var(--font-sans));
		font-size: var(--t-10, 0.6rem);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		border-radius: var(--r-4, 0.25rem);
	}

	.worlds-tag.is-wc {
		background: color-mix(in srgb, #ff6b2a 14%, transparent);
		color: #ff8a4c;
	}

	.worlds-tag.is-live {
		background: color-mix(in srgb, var(--no) 14%, transparent);
		color: var(--no);
	}

	.worlds-tag.is-live::before {
		content: '';
		width: 5px;
		height: 5px;
		border-radius: var(--r-pill);
		background: var(--no);
	}

	.worlds-tag.is-monthly {
		background: color-mix(in srgb, var(--laurel) 14%, transparent);
		color: var(--laurel);
	}

	.worlds-bout-hero-title {
		margin: 0 0 0.25rem;
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: var(--t-17, 1.05rem);
		line-height: 1.2;
		letter-spacing: var(--tracking-snug);
		color: var(--text-base);
	}

	.worlds-bout-hero-emph {
		color: var(--laurel);
		font-weight: 400;
	}

	.worlds-bout-hero-meta {
		margin: 0;
		font-size: var(--t-10, 0.65rem);
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}

	/* Scope toggle — mirrors WorldsPage's `worlds-scope`. */
	.worlds-bout-scope {
		display: flex;
		gap: 0.1rem;
		padding: 0.2rem;
		background: color-mix(in srgb, var(--text-base) 4%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-10, 0.625rem);
	}

	.worlds-bout-scope button {
		appearance: none;
		flex: 1;
		padding: 0.5rem 0.35rem;
		font: inherit;
		font-size: var(--t-12);
		font-weight: 500;
		color: var(--text-muted);
		background: transparent;
		border: 0;
		border-radius: var(--r-8, 0.45rem);
		cursor: pointer;
		transition:
			background 180ms ease,
			color 180ms ease;
	}

	.worlds-bout-scope button.is-active {
		color: var(--text-base);
		background: var(--bg-surface);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.16);
	}

	/* Leaderboard list */
	.worlds-bout-list {
		position: relative;
		display: flex;
		flex-direction: column;
	}

	.worlds-bout-empty {
		margin: 0 0 0.5rem;
		padding: 0.85rem 1rem;
		font-size: var(--t-12);
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px dashed var(--border-base);
		border-radius: var(--r-12);
	}

	.worlds-bout-row {
		appearance: none;
		display: grid;
		grid-template-columns: 24px 28px 1fr auto;
		gap: 0.6rem;
		align-items: center;
		width: 100%;
		padding: 0.65rem 0.5rem;
		font: inherit;
		text-align: left;
		color: var(--text-base);
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--border-base);
		cursor: pointer;
	}

	.worlds-bout-row:hover {
		background: color-mix(in srgb, var(--text-base) 3%, transparent);
	}

	.worlds-bout-rank {
		font-size: var(--t-12);
		font-weight: 700;
		text-align: center;
		color: var(--text-muted);
	}

	.worlds-bout-row.rank-1 .worlds-bout-rank {
		color: #e2b842;
	}

	.worlds-bout-row.rank-2 .worlds-bout-rank {
		color: #c0c5cb;
	}

	.worlds-bout-row.rank-3 .worlds-bout-rank {
		color: #b57c52;
	}

	.worlds-bout-glyph {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--t-13);
		color: var(--text-base);
		background: color-mix(in srgb, var(--laurel) 14%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
	}

	.worlds-bout-meta {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.worlds-bout-name {
		font-size: var(--t-13);
		font-weight: 600;
		letter-spacing: -0.005em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.worlds-bout-sub {
		margin-top: 0.05rem;
		font-size: var(--t-10, 0.6rem);
		letter-spacing: var(--tracking-wide);
		color: var(--text-muted);
	}

	.worlds-bout-pct {
		font-size: var(--t-13);
		font-weight: 700;
		text-align: right;
	}

	.worlds-bout-row.rank-1 .worlds-bout-pct {
		color: #e2b842;
	}

	.worlds-bout-row.is-you {
		background: color-mix(in srgb, var(--laurel) 6%, transparent);
	}

	.worlds-bout-row.is-you .worlds-bout-name,
	.worlds-bout-row.is-you .worlds-bout-pct {
		color: var(--laurel);
	}

	.worlds-bout-you {
		color: var(--laurel);
		font-weight: 700;
	}

	.worlds-bout-see-all {
		appearance: none;
		display: block;
		width: 100%;
		padding: 0.85rem 1rem;
		font: inherit;
		font-family: var(--font-mono, var(--font-sans));
		font-size: var(--t-10, 0.65rem);
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		text-align: center;
		color: var(--laurel);
		background: transparent;
		border: 0;
		cursor: pointer;
	}

	.worlds-bout-see-all:hover {
		background: color-mix(in srgb, var(--laurel) 4%, transparent);
	}

	/* Sticky YOU when affiliated user is outside the visible window. */
	.worlds-bout-you-sticky {
		position: sticky;
		bottom: calc(96px + env(safe-area-inset-bottom, 0px));
		display: grid;
		grid-template-columns: 24px 28px 1fr auto;
		gap: 0.6rem;
		align-items: center;
		padding: 0.65rem 0.5rem;
		background: var(--bg-surface);
		border-top: 1px solid color-mix(in srgb, var(--laurel) 35%, var(--border-base));
		border-bottom: 1px solid color-mix(in srgb, var(--laurel) 35%, var(--border-base));
		box-shadow: 0 -6px 16px -8px rgba(0, 0, 0, 0.4);
	}

	.worlds-bout-you-sticky .worlds-bout-rank {
		color: var(--laurel);
	}

	.worlds-bout-glyph.is-you {
		background: color-mix(in srgb, var(--laurel) 18%, transparent);
		box-shadow: 0 0 0 1px var(--laurel);
	}

	.worlds-bout-name-you {
		color: var(--laurel);
	}

	.worlds-bout-pct-you {
		color: var(--laurel);
	}

	/* Podium prizes — fixed VXP rungs. */
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
</style>
