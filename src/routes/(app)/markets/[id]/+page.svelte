<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import MarketDetailForecast from '$lib/components/market/MarketDetailForecast.svelte';
	import MarketDetailHeader from '$lib/components/market/MarketDetailHeader.svelte';
	import MarketDetailStats from '$lib/components/market/MarketDetailStats.svelte';
	import MarketDetailTabs from '$lib/components/market/MarketDetailTabs.svelte';
	import MarketInfoPanel from '$lib/components/market/MarketInfoPanel.svelte';
	import MarketResolutionInterface from '$lib/components/market/MarketResolutionInterface.svelte';
	import { pageMarketId } from '$lib/derived/page-market.derived';
	import { userIsAdminOrSolver } from '$lib/derived/user.derived';
	import { getMarket } from '$lib/services/market.services';
	import { getPositionsForMarket } from '$lib/services/position.services';
	import { showCompanion } from '$lib/stores/companion.store';
	import type { Market, MarketId } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
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
				line: 'Called it.',
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
	<title>{market ? market.title : 'Market'} | Vici Social Markets</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
	{#if loading}
		<div class="flex h-96 items-center justify-center">
			<div
				class="border-primary h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
			></div>
		</div>
	{:else if market}
		<div class="space-y-8 lg:space-y-12">
			<MarketDetailHeader {market} />

			<div class="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
				<div class="space-y-8 lg:col-span-8">
					<div class="lg:hidden">
						<MarketDetailStats {market} />
					</div>

					<MarketDetailForecast {market} {onPredictionPlaced} />

					<MarketDetailTabs {market} {positions} />
				</div>

				<aside class="hidden space-y-8 lg:col-span-4 lg:block">
					<MarketInfoPanel {market} />
				</aside>

				<div class="space-y-8 lg:hidden">
					<MarketInfoPanel {market} />
				</div>
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
			<h1 class="text-foreground text-4xl font-extrabold">404 - Market Not Found</h1>
			<p class="text-muted-foreground mt-4">
				The market you are seeking is either hidden or does not exist.
			</p>
			<a
				class="bg-primary text-primary-foreground hover:bg-primary/90 mt-8 rounded-xl px-8 py-3 font-bold transition-all"
				href="/static"
			>
				Return to Markets
			</a>
		</div>
	{/if}
</div>
