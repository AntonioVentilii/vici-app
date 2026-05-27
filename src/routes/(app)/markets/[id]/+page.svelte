<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import MarketDetailChartCard from '$lib/components/market/MarketDetailChartCard.svelte';
	import MarketDetailCtaBar from '$lib/components/market/MarketDetailCtaBar.svelte';
	import MarketDetailLivePill from '$lib/components/market/MarketDetailLivePill.svelte';
	import MarketDetailLockedToast from '$lib/components/market/MarketDetailLockedToast.svelte';
	import MarketDetailProbHero from '$lib/components/market/MarketDetailProbHero.svelte';
	import MarketDetailResolutionCard from '$lib/components/market/MarketDetailResolutionCard.svelte';
	import MarketDetailShareButton from '$lib/components/market/MarketDetailShareButton.svelte';
	import MarketDetailStatsGrid from '$lib/components/market/MarketDetailStatsGrid.svelte';
	import MarketDetailTopPredictors from '$lib/components/market/MarketDetailTopPredictors.svelte';
	import MarketMetadataForm from '$lib/components/market/MarketMetadataForm.svelte';
	import MarketResolutionInterface from '$lib/components/market/MarketResolutionInterface.svelte';
	import OutcomeBadge from '$lib/components/market/OutcomeBadge.svelte';
	import TradeModal from '$lib/components/market/TradeModal.svelte';
	import SavedMarketToggle from '$lib/components/saved-markets/SavedMarketToggle.svelte';
	import { MARKET_TAG_LABEL_KEYS } from '$lib/constants/market-tags.constants';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { marketTags } from '$lib/derived/market-tags.derived';
	import { pageMarketId } from '$lib/derived/page-market.derived';
	import {
		authPrincipal,
		userIsAdmin,
		userIsAdminOrSolver,
		userSignedIn
	} from '$lib/derived/user.derived';
	import { getMarket } from '$lib/services/market.services';
	import { getPositionsForMarket } from '$lib/services/position.services';
	import { showCompanion } from '$lib/stores/companion.store';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market, MarketId, OutcomeId } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
	import { t } from '$lib/utils/i18n.utils';
	import { goBack } from '$lib/utils/nav.utils';
	import { positionResolvedResult } from '$lib/utils/position.utils';
	import { tagColor } from '$lib/utils/tag-color.utils';

	let market = $state<Market | undefined>();

	let positions = $state<Position[]>([]);

	let loading = $state(true);

	let selectedSide = $state<OutcomeId | undefined>();

	let lockedToastOpen = $state(false);

	const fetchMarket = async ({ id, silent = false }: { id: MarketId; silent?: boolean }) => {
		if (!silent) {
			loading = true;
		}

		const [marketRes, positionsRes] = await Promise.all([getMarket(id), getPositionsForMarket(id)]);

		market = marketRes;
		positions = positionsRes;

		if (!silent) {
			loading = false;
		}
	};

	let intervalId: ReturnType<typeof setInterval> | undefined;

	onMount(() => {
		if (nonNullish($pageMarketId)) {
			fetchMarket({ id: $pageMarketId });

			intervalId = setInterval(() => {
				if (nonNullish($pageMarketId)) {
					fetchMarket({ id: $pageMarketId, silent: true });
				}
			}, 30000);
		}

		return () => {
			if (intervalId) {
				clearInterval(intervalId);
			}
		};
	});

	$effect(() => {
		if (nonNullish($pageMarketId) && (isNullish(market) || market.id !== $pageMarketId)) {
			fetchMarket({ id: $pageMarketId });
		}
	});

	const onPredictionPlaced = () => {
		// Confirmation overlay (`Locked in.`) — matches the prototype's
		// done-state choreography (`screens.jsx:323-333`). Held for
		// 1100ms so the user sees the acknowledgement, then we dismiss
		// the sheet and refetch the market silently.
		lockedToastOpen = true;
		selectedSide = undefined;

		setTimeout(() => {
			lockedToastOpen = false;
		}, 1100);

		if (nonNullish(market)) {
			fetchMarket({ id: market.id, silent: true });
		}
	};

	const tags = $derived(nonNullish(market) ? ($marketTags[market.id] ?? []) : []);
	const primaryTag = $derived(tags[0]);

	const yesPercent = $derived(
		nonNullish(market) ? Math.min(100, Math.max(0, Math.round(market.yesProbability * 100))) : 0
	);
	const noPercent = $derived(100 - yesPercent);

	const isResolved = $derived(market?.status === 'Resolved');
	const isLive = $derived(market?.status === 'Open');

	const canEditMetadata = $derived(
		nonNullish(market) && ($userIsAdmin || market.creator === $authPrincipal)
	);

	const canResolve = $derived(
		nonNullish(market) && market.status !== 'Resolved' && $userIsAdminOrSolver
	);

	const showAdminActions = $derived(canEditMetadata || canResolve);

	// Resolution choreography — see `docs/ai/frontend/design.md` §7.6.
	// On the first time the user views a resolved market they have a
	// position on:
	//   right call → Oracle 1.2 s, "Called it."
	//   wrong call → no character; the resolved panel + lost-state
	//                crossfade carry the acknowledgement.
	// Tracked in `sessionStorage` per market id so re-navigating to
	// the same page within a session doesn't re-fire.
	const RESOLUTION_BEAT_KEY_PREFIX = 'vici:resolution-beat:';
	let resolutionBeatTimeoutId: ReturnType<typeof setTimeout> | undefined;
	let resolutionBeatScheduledFor: string | undefined;

	$effect(() => {
		if (!browser) {
			return;
		}

		const m = market;

		if (isNullish(m) || m.status !== 'Resolved' || positions.length === 0) {
			return;
		}

		if (resolutionBeatScheduledFor === m.id) {
			return;
		}

		const wonAny = positions.some(
			(p) => positionResolvedResult({ market: m, position: p }) === 'won'
		);

		if (!wonAny) {
			return;
		}

		const beatKey = `${RESOLUTION_BEAT_KEY_PREFIX}${m.id}`;

		try {
			if (sessionStorage.getItem(beatKey) !== null) {
				resolutionBeatScheduledFor = m.id;

				return;
			}

			sessionStorage.setItem(beatKey, '1');
		} catch {
			// sessionStorage can throw in privacy modes / sandboxed
			// iframes — fail open: still fire the beat, just lose the
			// once-per-session guard.
		}

		resolutionBeatScheduledFor = m.id;
		resolutionBeatTimeoutId = setTimeout(() => {
			showCompanion({
				who: 'oracle',
				line: t({ locale: $localeStore, key: 'companion.oracle.called_it' }),
				dwell_ms: 1200,
				anchor: 'br'
			});
			resolutionBeatTimeoutId = undefined;
		}, 320);
	});

	onDestroy(() => {
		if (resolutionBeatTimeoutId !== undefined) {
			clearTimeout(resolutionBeatTimeoutId);
		}
	});

	const handlePick = (side: 'YES' | 'NO') => {
		if (isResolved) {
			return;
		}

		// Public market browse — `/markets/[id]` is exempted from the
		// (app)/+layout auth gate so signed-out visitors can preview a
		// market. Placing a call still requires a session, so we bounce
		// to /signin here at the point of action instead of opening the
		// TradeModal against a missing identity.
		if (!$userSignedIn) {
			void goto(resolve(PublicPath.SignIn));

			return;
		}

		selectedSide = side;
	};
</script>

<svelte:head>
	<title
		>{market ? market.title : t({ locale: $localeStore, key: 'market.detail.fallback_title' })} | Vici
		{t({ locale: $localeStore, key: 'market.detail.head_suffix' })}</title
	>
</svelte:head>

<div class="market-detail-screen">
	{#if loading}
		<div class="flex h-96 items-center justify-center">
			<div
				class="border-primary h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
			></div>
		</div>
	{:else if market}
		{@const m = market}
		{#snippet detailRight()}
			<MarketDetailShareButton title={m.title} />
			<!-- Save / "watch" — the prototype's eye glyph is functionally a
			     bookmark; we reuse the shared heart toggle so this surface
			     stays in lockstep with the per-card heart in the markets
			     list (`MarketCard`). -->
			<SavedMarketToggle marketId={m.id} size="md" stopPropagation={false} />
		{/snippet}

		<MobileAppBar
			back={{
				label: t({ locale: $localeStore, key: 'market.detail.back_to_markets' }),
				onBack: () => goBack(resolve(AppPath.Home))
			}}
			right={detailRight}
		/>

		<section class="market-detail-hero">
			<div class="market-detail-chip-row">
				{#if nonNullish(primaryTag)}
					<span style:color={tagColor(primaryTag)} class="market-detail-tag">
						{t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[primaryTag] })}
					</span>
				{/if}
				{#if isLive}
					<MarketDetailLivePill />
				{:else if isResolved}
					<span class="market-detail-tag-resolved">
						<OutcomeBadge status={market.status} />
					</span>
				{/if}
			</div>

			<h1 class="market-detail-title">{market.title}</h1>
		</section>

		<MarketDetailProbHero {noPercent} {yesPercent} />

		<MarketDetailChartCard marketId={market.id} {yesPercent} />

		<MarketDetailStatsGrid {market} {positions} />

		<MarketDetailResolutionCard {market} />

		<MarketDetailTopPredictors {market} />

		{#if showAdminActions}
			<section
				class="market-detail-admin"
				aria-label={t({ locale: $localeStore, key: 'market.detail.admin_actions' })}
			>
				{#if canEditMetadata}
					<MarketMetadataForm canEdit {market} />
				{/if}

				{#if canResolve}
					<MarketResolutionInterface
						{market}
						onSettled={() => {
							if (nonNullish(market)) {
								fetchMarket({ id: market.id, silent: true });
							}
						}}
					/>
				{/if}
			</section>
		{/if}

		{#if !isResolved}
			<MarketDetailCtaBar disabled={isResolved} {noPercent} onPick={handlePick} {yesPercent} />
		{/if}

		{#if nonNullish(selectedSide)}
			<TradeModal
				{market}
				onClose={() => (selectedSide = undefined)}
				{onPredictionPlaced}
				selectedOutcome={selectedSide}
			/>
		{/if}

		<MarketDetailLockedToast open={lockedToastOpen} />
	{:else}
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<h1 class="text-foreground text-4xl font-extrabold">
				{t({ locale: $localeStore, key: 'market.detail.not_found.title' })}
			</h1>
			<p class="text-muted-foreground mt-4">
				{t({ locale: $localeStore, key: 'market.detail.not_found.sub' })}
			</p>
			<a
				class="bg-primary text-primary-foreground hover:bg-primary/90 mt-8 rounded-xl px-8 py-3 font-bold transition-all"
				href={resolve(AppPath.Home)}
			>
				{t({ locale: $localeStore, key: 'market.detail.not_found.cta' })}
			</a>
		</div>
	{/if}
</div>

<style lang="postcss">
	.market-detail-screen {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0;
		/* Leave room for the sticky bottom CTA bar (≈64px + safe-area). */
		padding: 0.25rem 0 6rem;
	}

	.market-detail-hero {
		padding: 0.5rem 1.25rem 0;
	}

	.market-detail-chip-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
	}

	/* Category tag: no background, no border — just colored text. The
	   prototype renders categories on the detail hero as a bare text
	   chip so the title gets all the visual weight. */
	.market-detail-tag {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.market-detail-tag-resolved {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.45rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--bg-surface) 70%, transparent);
	}

	.market-detail-title {
		margin: 0.625rem 0 0;
		color: var(--text-base);
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.22;
	}

	.market-detail-admin {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin: 1rem 1.25rem 0;
		padding-top: 1.25rem;
		border-top: 1px solid var(--border-base);
	}

	@media (min-width: 768px) {
		.market-detail-title {
			font-size: 1.75rem;
		}
	}
</style>
