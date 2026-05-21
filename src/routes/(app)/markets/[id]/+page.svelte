<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { Bell } from 'lucide-svelte/icons';
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import MarketDetailForecast from '$lib/components/market/MarketDetailForecast.svelte';
	import MarketDetailHeader from '$lib/components/market/MarketDetailHeader.svelte';
	import MarketDetailStats from '$lib/components/market/MarketDetailStats.svelte';
	import MarketDetailTabs from '$lib/components/market/MarketDetailTabs.svelte';
	import MarketInfoPanel from '$lib/components/market/MarketInfoPanel.svelte';
	import MarketMetadataForm from '$lib/components/market/MarketMetadataForm.svelte';
	import MarketResolutionInterface from '$lib/components/market/MarketResolutionInterface.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { pageMarketId } from '$lib/derived/page-market.derived';
	import { authPrincipal, userIsAdmin, userIsAdminOrSolver } from '$lib/derived/user.derived';
	import { getMarket } from '$lib/services/market.services';
	import { getPositionsForMarket } from '$lib/services/position.services';
	import { showCompanion } from '$lib/stores/companion.store';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market, MarketId } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
	import { t } from '$lib/utils/i18n.utils';
	import { positionResolvedResult } from '$lib/utils/position.utils';

	let market = $state<Market | undefined>();

	let positions = $state<Position[]>([]);

	let loading = $state(true);

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
		if (nonNullish(market)) {
			fetchMarket({ id: market.id, silent: true });
		}
	};

	const canEditMetadata = $derived(
		nonNullish(market) && ($userIsAdmin || market.creator === $authPrincipal)
	);

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

		// Guard against re-runs of this effect (e.g. when the 30 s
		// silent refetch updates `market` / `positions`) cancelling the
		// 320 ms timeout before it fires. Schedule once per market id;
		// `onDestroy` does the unmount cleanup instead of $effect.
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
</script>

<svelte:head>
	<title
		>{market ? market.title : t({ locale: $localeStore, key: 'market.detail.fallback_title' })} | Vici
		Social Markets</title
	>
</svelte:head>

<div class="market-detail-shell">
	{#if loading}
		<div class="flex h-96 items-center justify-center">
			<div
				class="border-primary h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
			></div>
		</div>
	{:else if market}
		{#snippet detailRight()}
			<button
				class="market-detail-bell"
				aria-label={t({ locale: $localeStore, key: 'a11y.notifications' })}
				type="button"
			>
				<Bell aria-hidden="true" size={16} strokeWidth={1.8} />
			</button>
		{/snippet}

		<div class="market-detail-stack">
			<MobileAppBar
				back={{
					label: t({ locale: $localeStore, key: 'market.detail.back_to_markets' }),
					onBack: () => void goto(resolve(AppPath.Home))
				}}
				right={detailRight}
				title={market.title}
			/>

			<MarketDetailHeader {market} />

			<div class="market-detail-grid">
				<div class="market-detail-main">
					<div class="market-detail-mobile-stats">
						<MarketDetailStats {market} />
					</div>

					<MarketDetailForecast {market} {onPredictionPlaced} />

					<MarketDetailTabs {market} {positions} />

					<div class="market-detail-mobile-info">
						<MarketInfoPanel {market} />
					</div>

					{#if canEditMetadata}
						<MarketMetadataForm canEdit {market} />
					{/if}
				</div>

				<aside class="market-detail-aside">
					<MarketDetailStats {market} />
					<MarketInfoPanel {market} />
				</aside>
			</div>

			{#if market.status !== 'Resolved' && $userIsAdminOrSolver}
				<div class="border-border mx-auto max-w-4xl border-t pt-12">
					<MarketResolutionInterface
						{market}
						onSettled={() => {
							if (nonNullish(market)) {
								fetchMarket({ id: market.id, silent: true });
							}
						}}
					/>
				</div>
			{/if}
		</div>
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
	.market-detail-shell {
		position: relative;
		margin: 0 auto;
		width: 100%;
		max-width: 74rem;
		padding: 0.75rem 1rem 2rem;
	}

	.market-detail-shell::before {
		content: '';
		position: fixed;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background:
			radial-gradient(circle at 50% -10%, var(--laurel-glow), transparent 34%),
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--bg-surface) 42%, transparent),
				transparent 18rem
			);
	}

	.market-detail-stack {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.market-detail-bell {
		display: inline-flex;
		width: 2.25rem;
		height: 2.25rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-surface);
		color: var(--text-muted);
	}

	.market-detail-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
	}

	.market-detail-main,
	.market-detail-aside {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}

	.market-detail-aside {
		display: none;
	}

	@media (min-width: 768px) {
		.market-detail-shell {
			padding: 1rem 1.5rem 3rem;
		}
	}

	@media (min-width: 1024px) {
		.market-detail-stack {
			gap: 1.25rem;
		}

		.market-detail-grid {
			grid-template-columns: minmax(0, 1fr) 22rem;
			gap: 1.25rem;
			align-items: start;
		}

		.market-detail-mobile-stats {
			display: none;
		}

		.market-detail-mobile-info {
			display: none;
		}

		.market-detail-aside {
			display: flex;
			position: sticky;
			top: calc(var(--header-h) + 1rem);
		}
	}
</style>
