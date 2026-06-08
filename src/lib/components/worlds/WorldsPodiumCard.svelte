<script lang="ts">
	import CountryFlag from '$lib/components/ui/CountryFlag.svelte';
	import { lookupWorldsAffiliation } from '$lib/constants/worlds-affiliations.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { AffiliationStatsDoc } from '$lib/types/affiliation-stats';
	import {
		affiliationLifetimeAccuracy,
		affiliationMonthlyAccuracy,
		formatAccuracyPercent
	} from '$lib/utils/affiliation-stats.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Worlds featured WC podium + monthly compact card. Rendered twice on
	 * the Battles inbox — once for the university roster and once for the
	 * country roster — branching glyph-vs-flag rendering and i18n copy on
	 * `kind`. The parent owns ranking/selection (via the shared
	 * `compareAffiliationByLifetime` comparator); this component only
	 * presents the precomputed top-3, the viewer's stats, and the rank, so
	 * it never re-sorts.
	 */
	interface Props {
		kind: 'university' | 'country';
		// Precomputed top-3 by lifetime (WC) accuracy.
		top3: AffiliationStatsDoc[];
		// Viewer's affiliation identifier, or undefined when unaffiliated.
		myAffiliationIdentifier: string | undefined;
		// Viewer's own stats doc within this roster (undefined when absent).
		myStats: AffiliationStatsDoc | undefined;
		// Viewer's rank within the roster (1-based; 0 when unranked).
		myRank: number;
		// Total roster size for the "rank / total" line.
		total: number;
		// Days until the WC final, or null when unavailable.
		eventDaysLeft: number | null;
		// Current month label for the monthly card tag.
		currentMonthName: string;
		// Apply the top separator that divides stacked sections.
		divided?: boolean;
		onOpenWc: () => void;
		onOpenMonth: () => void;
	}

	const {
		kind,
		top3,
		myAffiliationIdentifier,
		myStats,
		myRank,
		total,
		eventDaysLeft,
		currentMonthName,
		divided = false,
		onOpenWc,
		onOpenMonth
	}: Props = $props();

	const isCountry = $derived(kind === 'country');

	const option = (id: string) => lookupWorldsAffiliation({ kind, id });

	const eyebrowKey = $derived<MessageKey>(
		isCountry ? 'battles.section.worlds_countries' : 'battles.section.worlds_universities'
	);
	const titleLedeKey = $derived<MessageKey>(
		isCountry ? 'battles.country.wc_title_lede' : 'battles.uni.wc_title_lede'
	);
	const titleEmphKey = $derived<MessageKey>(
		isCountry ? 'battles.country.wc_title_emph' : 'battles.uni.wc_title_emph'
	);
	const titleTailKey = $derived<MessageKey>(
		isCountry ? 'battles.country.wc_title_tail' : 'battles.uni.wc_title_tail'
	);

	const myOption = $derived(
		myAffiliationIdentifier !== undefined ? option(myAffiliationIdentifier) : undefined
	);
	const myName = $derived(myOption?.name ?? myAffiliationIdentifier ?? '');
</script>

<section
	class="battles-section"
	class:is-divided={divided}
	aria-label={t({ locale: $localeStore, key: eyebrowKey })}
>
	<header class="battles-section-head">
		<span class="battles-eyebrow allcaps">
			{t({ locale: $localeStore, key: eyebrowKey })}
		</span>
		{#if myAffiliationIdentifier !== undefined}
			{#if isCountry}
				<span class="battles-section-head-meta num allcaps">
					{#if myOption}<CountryFlag class="battles-section-flag" countryCode={myOption.id} />{/if}
					{myName.toUpperCase()}
				</span>
			{:else}
				<span class="battles-section-head-meta num allcaps">
					{t({
						locale: $localeStore,
						key: 'battles.your_school',
						params: { name: myName }
					})}
				</span>
			{/if}
		{/if}
	</header>

	<button class="battles-card is-featured" onclick={onOpenWc} type="button">
		<div class="battles-card-head">
			<div class="battles-card-tags">
				<span class="battles-tag is-wc">
					{t({ locale: $localeStore, key: 'worlds.event.tag_wc' })}
				</span>
				<span class="battles-tag is-live">
					{t({ locale: $localeStore, key: 'worlds.event.tag_live' })}
				</span>
			</div>
			{#if eventDaysLeft !== null}
				<span class="battles-card-timer num">
					{t({
						locale: $localeStore,
						key: 'battles.card.days_left',
						params: { days: eventDaysLeft }
					})}
				</span>
			{/if}
		</div>
		<h3 class="battles-card-title">
			{t({ locale: $localeStore, key: titleLedeKey })}
			<span class="serif-italic">
				{t({ locale: $localeStore, key: titleEmphKey })}
			</span>
			{t({ locale: $localeStore, key: titleTailKey })}
		</h3>
		<p class="battles-card-meta">
			{#if isCountry}
				{t({ locale: $localeStore, key: 'battles.country.wc_sub', params: { nations: total } })}
			{:else}
				{t({ locale: $localeStore, key: 'battles.uni.wc_sub', params: { schools: total } })}
			{/if}
		</p>

		{#if top3.length > 0}
			<div class="battles-podium">
				{#if top3[1]}
					{@const opt = option(top3[1].affiliationIdentifier)}
					<div class="battles-pod-tile is-silver">
						<div class="num battles-pod-place">02</div>
						<div class="battles-pod-name">
							{#if isCountry && opt}<CountryFlag
									class="battles-pod-flag"
									countryCode={opt.id}
								/>{/if}
							{opt?.name ?? top3[1].affiliationIdentifier}
						</div>
						<div class="num battles-pod-pct">
							{formatAccuracyPercent(affiliationLifetimeAccuracy(top3[1]))}
						</div>
					</div>
				{/if}
				{#if top3[0]}
					{@const opt = option(top3[0].affiliationIdentifier)}
					<div class="battles-pod-tile is-gold">
						<div class="num battles-pod-place">01</div>
						<div class="battles-pod-name">
							{#if isCountry && opt}<CountryFlag
									class="battles-pod-flag"
									countryCode={opt.id}
								/>{/if}
							{opt?.name ?? top3[0].affiliationIdentifier}
						</div>
						<div class="num battles-pod-pct">
							{formatAccuracyPercent(affiliationLifetimeAccuracy(top3[0]))}
						</div>
					</div>
				{/if}
				{#if top3[2]}
					{@const opt = option(top3[2].affiliationIdentifier)}
					<div class="battles-pod-tile is-bronze">
						<div class="num battles-pod-place">03</div>
						<div class="battles-pod-name">
							{#if isCountry && opt}<CountryFlag
									class="battles-pod-flag"
									countryCode={opt.id}
								/>{/if}
							{opt?.name ?? top3[2].affiliationIdentifier}
						</div>
						<div class="num battles-pod-pct">
							{formatAccuracyPercent(affiliationLifetimeAccuracy(top3[2]))}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		{#if myAffiliationIdentifier !== undefined && myStats}
			<div class="battles-your-row">
				<span class="battles-your-em" aria-hidden="true">
					{#if isCountry}
						{#if myOption}<CountryFlag class="battles-your-flag" countryCode={myOption.id} />{/if}
					{:else}
						{myName.charAt(0)}
					{/if}
				</span>
				<span class="battles-your-text">
					<b>{myName}</b>
					·
					{t({
						locale: $localeStore,
						key: 'battles.your_rank',
						params: { rank: myRank, total }
					})}
				</span>
				<span class="num battles-your-pct"
					>{formatAccuracyPercent(affiliationLifetimeAccuracy(myStats))}</span
				>
			</div>
		{/if}
	</button>

	<button class="battles-card is-compact" onclick={onOpenMonth} type="button">
		<div class="battles-card-head">
			<span class="battles-tag is-monthly">
				{t({
					locale: $localeStore,
					key: 'battles.tag.monthly_all_calls',
					params: { month: currentMonthName }
				})}
			</span>
		</div>
		{#if myAffiliationIdentifier !== undefined && myStats}
			<div class="battles-your-row is-tight">
				<span class="battles-your-em" aria-hidden="true">
					{#if isCountry}
						{#if myOption}<CountryFlag class="battles-your-flag" countryCode={myOption.id} />{/if}
					{:else}
						{myName.charAt(0)}
					{/if}
				</span>
				<span class="battles-your-text">
					<b>{myName}</b>
					·
					{t({
						locale: $localeStore,
						key: 'battles.your_rank',
						params: { rank: myRank, total }
					})}
				</span>
				<span class="num battles-your-pct"
					>{formatAccuracyPercent(affiliationMonthlyAccuracy(myStats))}</span
				>
			</div>
		{:else}
			<p class="battles-card-meta">
				{#if isCountry}
					{t({ locale: $localeStore, key: 'battles.country.month_pick', params: { count: total } })}
				{:else}
					{t({ locale: $localeStore, key: 'battles.uni.month_pick', params: { count: total } })}
				{/if}
			</p>
		{/if}
		<span class="battles-see-all allcaps">
			{t({ locale: $localeStore, key: 'battles.see_full_standings' })}
		</span>
	</button>
</section>

<style lang="postcss">
	/* ─── section ────────────────────────────────────────────── */
	.battles-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* Separator between stacked surface sections — a hairline rule with a
	   short centered golden accent line riding the top edge. */
	.battles-section.is-divided {
		position: relative;
		margin-top: 28px;
		padding-top: 20px;
		border-top: 1px solid var(--border-base);
	}

	.battles-section.is-divided::before {
		content: '';
		position: absolute;
		top: -1px;
		left: 50%;
		transform: translateX(-50%);
		width: 48px;
		height: 1px;
		background: var(--laurel);
		opacity: 0.5;
	}

	.battles-section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		margin-bottom: 0.1rem;
	}

	.battles-eyebrow {
		font-family: var(--font-mono);
		font-size: var(--t-10);
		letter-spacing: 0.16em;
		color: var(--text-muted);
	}

	.battles-section-head-meta {
		font-size: var(--t-10);
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}

	/* ─── grouped card ───────────────────────────────────────── */
	.battles-card {
		appearance: none;
		display: block;
		width: 100%;
		padding: 0.9rem;
		font: inherit;
		text-align: left;
		color: var(--text-base);
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--laurel) 10%, transparent), transparent 70%),
			var(--bg-surface);
		border: 1px solid color-mix(in srgb, var(--laurel) 22%, var(--border-base));
		border-radius: var(--r-14, 0.85rem);
		cursor: pointer;
		transition: border-color 160ms ease;
	}

	.battles-card:hover {
		border-color: color-mix(in srgb, var(--laurel) 38%, var(--border-base));
	}

	.battles-card.is-compact {
		padding: 0.75rem 0.9rem;
	}

	.battles-card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.4rem;
	}

	.battles-card-tags {
		display: inline-flex;
		gap: 0.3rem;
	}

	.battles-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.15rem 0.4rem;
		font-family: var(--font-mono, var(--font-sans));
		font-size: var(--t-10);
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		border-radius: var(--r-4, 0.25rem);
	}

	.battles-tag.is-wc {
		background: color-mix(in srgb, #ff6b2a 14%, transparent);
		color: #ff8a4c;
	}

	.battles-tag.is-live {
		background: color-mix(in srgb, var(--no) 14%, transparent);
		color: var(--no);
	}

	.battles-tag.is-live::before {
		content: '';
		width: 5px;
		height: 5px;
		border-radius: var(--r-pill);
		background: var(--no);
		animation: battles-live-pulse 1.6s infinite;
	}

	@keyframes battles-live-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.battles-tag.is-live::before {
			animation: none;
		}
	}

	.battles-tag.is-monthly {
		background: color-mix(in srgb, var(--laurel) 12%, transparent);
		color: var(--laurel);
	}

	.battles-card-timer {
		font-size: var(--t-10);
		color: var(--text-muted);
	}

	.battles-card-title {
		margin: 0 0 0.25rem;
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: 1.0625rem;
		line-height: 1.25;
		letter-spacing: var(--tracking-snug);
		color: var(--text-base);
		text-wrap: balance;
	}

	.battles-card-title .serif-italic {
		color: var(--laurel);
		font-weight: 400;
	}

	.battles-card-meta {
		margin: 0 0 0.6rem;
		font-family: var(--font-mono);
		font-size: var(--t-10);
		color: var(--text-muted);
		letter-spacing: var(--tracking-wide);
	}

	/* ─── podium ─────────────────────────────────────────────── */
	.battles-podium {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.4rem;
		margin-bottom: 0.6rem;
	}

	.battles-pod-tile {
		padding: 0.55rem 0.3rem;
		text-align: center;
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-10, 0.6rem);
		transition:
			transform 100ms ease,
			border-color 180ms ease;
	}

	.battles-pod-tile:hover {
		border-color: var(--border-strong, var(--border-base));
		transform: translateY(-1px);
	}

	@media (prefers-reduced-motion: reduce) {
		.battles-pod-tile {
			transition: border-color 180ms ease;
		}

		.battles-pod-tile:hover {
			transform: none;
		}
	}

	.battles-pod-tile.is-gold {
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, #e2b842 20%, transparent),
				color-mix(in srgb, #e2b842 6%, transparent) 70%
			),
			var(--bg-surface);
		border-color: color-mix(in srgb, #e2b842 40%, var(--border-base));
	}

	.battles-pod-tile.is-silver {
		background:
			linear-gradient(180deg, color-mix(in srgb, #c0c5cb 14%, transparent), transparent 70%),
			var(--bg-surface);
	}

	.battles-pod-tile.is-bronze {
		background:
			linear-gradient(180deg, color-mix(in srgb, #b57c52 14%, transparent), transparent 70%),
			var(--bg-surface);
	}

	.battles-pod-place {
		font-size: var(--t-10);
		font-weight: 700;
		color: var(--text-muted);
	}

	.battles-pod-tile.is-gold .battles-pod-place {
		color: #e2b842;
	}

	.battles-pod-tile.is-silver .battles-pod-place {
		color: #c0c5cb;
	}

	.battles-pod-tile.is-bronze .battles-pod-place {
		color: #b57c52;
	}

	.battles-pod-name {
		margin-top: 0.18rem;
		font-size: var(--t-11);
		font-weight: 600;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.battles-pod-pct {
		margin-top: 0.1rem;
		font-size: var(--t-10);
		letter-spacing: var(--tracking-wide);
		color: var(--text-muted);
	}

	.battles-pod-tile.is-gold .battles-pod-pct {
		color: #e2b842;
		font-weight: 700;
	}

	/* ─── your-row inside grouped card ──────────────────────── */
	.battles-your-row {
		display: grid;
		grid-template-columns: 24px 1fr auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.6rem;
		background: color-mix(in srgb, var(--laurel) 6%, transparent);
		border: 1px solid color-mix(in srgb, var(--laurel) 18%, var(--border-base));
		border-radius: var(--r-10, 0.6rem);
	}

	.battles-your-row.is-tight {
		margin-top: 0.3rem;
	}

	.battles-your-em {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--t-13);
		color: var(--text-base);
		background: color-mix(in srgb, var(--laurel) 14%, transparent);
		border-radius: var(--r-pill);
	}

	.battles-your-text {
		font-size: var(--t-12);
		color: var(--text-base);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.battles-your-pct {
		font-size: var(--t-13);
		font-weight: 700;
		color: var(--laurel);
	}

	/* ─── see-all ───────────────────────────────────────────── */
	.battles-see-all {
		display: block;
		margin-top: 0.55rem;
		font-family: var(--font-mono, var(--font-sans));
		font-size: var(--t-10);
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--laurel);
	}
</style>
