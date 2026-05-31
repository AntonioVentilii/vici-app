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
	import MarketDetailSkeleton from '$lib/components/market/MarketDetailSkeleton.svelte';
	import MarketDetailStatsGrid from '$lib/components/market/MarketDetailStatsGrid.svelte';
	import MarketDetailTopPredictors from '$lib/components/market/MarketDetailTopPredictors.svelte';
	import MarketDetailWhyNow from '$lib/components/market/MarketDetailWhyNow.svelte';
	import MarketMetadataForm from '$lib/components/market/MarketMetadataForm.svelte';
	import MarketResolutionInterface from '$lib/components/market/MarketResolutionInterface.svelte';
	import OutcomeBadge from '$lib/components/market/OutcomeBadge.svelte';
	import TradeModal from '$lib/components/market/TradeModal.svelte';
	import SavedMarketToggle from '$lib/components/saved-markets/SavedMarketToggle.svelte';
	import { categoryLabel } from '$lib/constants/market-tags.constants';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { marketMetadata } from '$lib/derived/market-metadata.derived';
	import { marketTags } from '$lib/derived/market-tags.derived';
	import { pageMarketId } from '$lib/derived/page-market.derived';
	import { resolvedPositions } from '$lib/derived/resolved-positions.derived';
	import {
		authPrincipal,
		userIsAdmin,
		userIsAdminOrSolver,
		userSignedIn
	} from '$lib/derived/user.derived';
	import { getUserMarketSignals } from '$lib/services/market-signals.services';
	import { getMarket } from '$lib/services/market.services';
	import { getPositionsForMarket } from '$lib/services/position.services';
	import { showCompanion } from '$lib/stores/companion.store';
	import { localeStore } from '$lib/stores/locale.store';
	import type { CallSide, Market, MarketId } from '$lib/types/market';
	import type { FollowedLeanSignal, PriorCallSignal } from '$lib/types/market-signals';
	import type { Position, ResolvedPosition } from '$lib/types/position';
	import { t } from '$lib/utils/i18n.utils';
	import { goBack } from '$lib/utils/nav.utils';
	import { positionResolvedResult } from '$lib/utils/position.utils';
	import { tagColor } from '$lib/utils/tag-color.utils';

	let market = $state<Market | undefined>();

	let positions = $state<Position[]>([]);

	// Viewer-relative market signals (the prior call they hold here, the
	// lean of the people they follow). Sparse by construction — absent
	// when signed-out or when no signal exists for this market — so the
	// surfaces that read them simply omit their row rather than show
	// invented data.
	let followedLean = $state<FollowedLeanSignal | undefined>();
	let priorCall = $state<PriorCallSignal | undefined>();

	let loading = $state(true);

	let selectedSide = $state<CallSide | undefined>();

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

		// Signals only change with the viewer's own activity, not with
		// the 30s consensus poll — fetch them on the foreground load and
		// skip the silent refresh so we don't re-pull trade history +
		// friend activity every tick.
		if (!silent) {
			void fetchSignals(marketRes);
		}
	};

	// Viewer-relative signals are a secondary, signed-in-only fetch
	// (trade history + the activity of people the viewer follows). It
	// rides on top of the market load rather than blocking the first
	// paint, and fails open: any error just leaves the prior-call /
	// followed-lean rows hidden.
	const fetchSignals = async (m: Market | undefined) => {
		if (isNullish(m) || !$userSignedIn) {
			followedLean = undefined;
			priorCall = undefined;

			return;
		}

		try {
			const signals = await getUserMarketSignals({ domain: m.balanceDomain });

			followedLean = signals.followedLean[m.id];
			priorCall = signals.priorCalls[m.id];
		} catch {
			followedLean = undefined;
			priorCall = undefined;
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
		// Confirmation overlay (`Locked in.`) — done-state choreography.
		// Held for 1100 ms so the user sees the acknowledgement, then
		// we dismiss the sheet and refetch the market silently.
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

	// Curated metadata for this market — the editorial subtitle (the
	// context line under the title) and the "why this card now" cue.
	const metadata = $derived(nonNullish(market) ? $marketMetadata[market.id] : undefined);
	const contextLine = $derived(metadata?.subtitle?.trim() ?? '');
	const whyNow = $derived(metadata?.whyNow);

	const yesPercent = $derived(
		nonNullish(market) ? Math.min(100, Math.max(0, Math.round(market.yesProbability * 100))) : 0
	);
	const noPercent = $derived(100 - yesPercent);

	const isResolved = $derived(market?.status === 'Resolved');
	const isLive = $derived(market?.status === 'Open');

	// Resolved entries from the user's `Settled` event stream that match
	// this market. Used to keep the resolution UX (MY CALL stat,
	// "Called it." beat) working after the clearing canister removes the
	// live `Position` row at settlement.
	const resolvedForMarket = $derived.by<ResolvedPosition[]>(() => {
		const m = market;

		if (isNullish(m)) {
			return [];
		}

		return $resolvedPositions.filter((r) => r.marketId === m.id);
	});

	const wonThisMarket = $derived(resolvedForMarket.some((r) => r.result === 'won'));

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

		if (isNullish(m) || m.status !== 'Resolved') {
			return;
		}

		if (resolutionBeatScheduledFor === m.id) {
			return;
		}

		// Win is detected from either source so the beat keeps firing
		// after the clearing canister removes the live `Position`:
		//   - `positions` is fresh during the brief window between trade
		//     and settlement (used for the immediate post-resolve refresh).
		//   - `resolvedForMarket` is the durable record sourced from the
		//     `Settled` event stream.
		const wonLive = positions.some(
			(p) => positionResolvedResult({ market: m, position: p }) === 'won'
		);
		const wonAny = wonLive || wonThisMarket;

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
		// Only an open market accepts calls — expired/resolved short-circuit.
		if (!isLive) {
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
		<MarketDetailSkeleton />
	{:else if market}
		{@const m = market}
		{#snippet detailRight()}
			<MarketDetailShareButton title={m.title} />
			<!-- Eye / "watch this market" save control. Same shared
			     toggle (and same watchlist backend) as the per-card
			     heart, here wearing the eye glyph and the faint ghost
			     header look so the three app-bar controls read as one
			     set. -->
			<SavedMarketToggle
				icon="eye"
				marketId={m.id}
				size="md"
				stopPropagation={false}
				variant="header-ghost"
			/>
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
						{categoryLabel({ category: primaryTag, variant: 'full', locale: $localeStore })}
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

			{#if contextLine !== ''}
				<p class="market-detail-context">{contextLine}</p>
			{/if}

			<MarketDetailWhyNow {priorCall} {whyNow} />
		</section>

		<MarketDetailProbHero {noPercent} {yesPercent} />

		<MarketDetailChartCard marketId={market.id} {yesPercent} />

		<MarketDetailStatsGrid {market} {positions} {resolvedForMarket} />

		<MarketDetailResolutionCard {market} />

		<MarketDetailTopPredictors {followedLean} {market} />

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

		<!-- CTA bar is only meaningful while the market is taking calls.
		     Expired (closed, awaiting resolution) and Resolved markets both
		     suppress it so the YES/NO actions can't be tapped against a
		     market that no longer accepts predictions. -->
		{#if isLive}
			<MarketDetailCtaBar {noPercent} onPick={handlePick} {yesPercent} />
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
		/* Leave room for the floating CTA bar and—when present—the
		   navpill it sits above. `--navpill-h` is injected by the (app)
		   layout: 88px when signed-in mobile, 0px for signed-out visitors
		   and desktop ≥56rem. The CTA bar itself is ~80px, so the bottom
		   pad is: safe-area + navpill + CTA (~5rem) + a little breathing
		   room. */
		padding: 0.25rem 0 calc(env(safe-area-inset-bottom, 0px) + var(--navpill-h, 0px) + 6rem);
	}

	/* Scope the ghost header look to this detail app-bar only. The
	   global `.appbar-icon-btn` (shared by Profile, Settings, Wallet,
	   etc.) is a transparent borderless circle; here the back chevron
	   picks up a faint resting foreground wash and a softer rounded-rect
	   radius so it reads as one set with the share and save controls.
	   These two selectors are more specific than the base rule and so
	   keep winning. The fill is a foreground wash so it adapts across
	   themes. */
	.market-detail-screen :global(.appbar-icon-btn) {
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--text-base) 6%, transparent);
	}

	.market-detail-screen :global(.appbar-icon-btn:hover) {
		background: color-mix(in srgb, var(--text-base) 11%, transparent);
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

	/* Category tag: no background, no border — just coloured text.
	   A bare text chip so the title gets all the visual weight. */
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

	/* Editorial context line under the title — the question's one-line
	   framing (e.g. "Hex contenders · 17.9% favorite"). Dimmed body
	   copy so the title keeps the visual weight. */
	.market-detail-context {
		margin: 0.375rem 0 0;
		color: var(--fg-dim);
		font-size: var(--t-13);
		line-height: 1.45;
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

	/* On desktop (≥56rem) the navpill is hidden and the CTA bar sits at a
	   fixed 2rem from the bottom, so the scroll clearance only needs to
	   accommodate the CTA bar height plus a standard margin. */
	@media (min-width: 56rem) {
		.market-detail-screen {
			padding-bottom: 8rem;
		}
	}
</style>
