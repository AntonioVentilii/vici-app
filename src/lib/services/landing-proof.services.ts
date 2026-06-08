import { getSeriesPriceHistory } from '$lib/api/clearing.api';
import { listSeries } from '$lib/api/registry.api';
import type { MarketTag } from '$lib/constants/market-tags.constants';
import { getIdentityOrAnonymous } from '$lib/services/identity.services';
import { listMarketTagsBySeries } from '$lib/services/market-tags.services';

/**
 * Real, anonymous "people calling the World Cup right now" aggregate for the
 * landing proof band.
 *
 * Reads are anonymous by construction: the registry catalog, the public
 * `MARKET_METADATA` tag projection, and clearing's market-wide price history
 * are all public query methods, so the pre-auth landing can call them under
 * the `AnonymousIdentity` (same path the Flow deck preview already uses).
 *
 * Source field: clearing's `get_series_price_history` exposes a per-bucket
 * `trade_count` (number of executed trades). We sum it across every World-Cup
 * tagged binary series. This is the closest WC-scoped *real* on-chain proxy
 * for caller activity — the registry `Series` carries no headcount, the
 * `Market.outcomes[].totalPredictions` view field is never populated by
 * `mapMarketData`, and `aggregate_lean` needs a caller-supplied principal set
 * (no global count). Executed predictions on WC markets is a genuine figure.
 */

const WC_TAG: MarketTag = 'wc';

/**
 * Session cache. The landing is a marketing surface — one anonymous read per
 * session is plenty; we never poll. `undefined` means "not yet resolved".
 */
let cached: number | undefined;

/**
 * Resolves the real aggregate count of executed predictions across the
 * World-Cup markets, anonymously. Returns `undefined` when the figure can't
 * be derived (no WC markets, no trades, or any error) so the caller keeps its
 * placeholder dash rather than ever rendering a fake number / 0 / blank.
 *
 * Cached for the session: repeated mounts reuse the first resolved value.
 */
export const getWorldCupCallerCount = async (): Promise<number | undefined> => {
	if (cached !== undefined) {
		return cached;
	}

	try {
		const identity = await getIdentityOrAnonymous();

		// `seriesId -> tags` over the public metadata collection; pick the WC set.
		const tagsBySeries = await listMarketTagsBySeries();
		const wcSeriesIds = new Set(
			Object.entries(tagsBySeries)
				.filter(([, tags]) => tags.includes(WC_TAG))
				.map(([seriesId]) => seriesId)
		);

		if (wcSeriesIds.size === 0) {
			return;
		}

		// Scope to live binary WC series that still exist in the registry catalog
		// (a stale tag doc must not drive a clearing read for a dropped series).
		const series = await listSeries({ identity, certified: false });
		const targets = series.filter((s) => 'Binary' in s.payoff_type && wcSeriesIds.has(s.series_id));

		if (targets.length === 0) {
			return;
		}

		// Sum executed-trade counts across every WC series. Daily candles keep
		// each response small; a single failed series read degrades to 0 for that
		// series rather than collapsing the whole aggregate.
		const counts = await Promise.all(
			targets.map(async (s) => {
				try {
					const candles = await getSeriesPriceHistory({
						identity,
						seriesId: s.series_id,
						interval: { Day: null },
						certified: false
					});

					return candles.reduce((acc, candle) => acc + Number(candle.trade_count), 0);
				} catch (err: unknown) {
					console.error('Failed to read WC series price history', s.series_id, err);

					return 0;
				}
			})
		);

		const total = counts.reduce((acc, n) => acc + n, 0);

		if (!Number.isFinite(total) || total <= 0) {
			return;
		}

		cached = total;

		return cached;
	} catch (err: unknown) {
		// Pre-auth marketing surface: never throw, never block render. Fall
		// through to the implicit `undefined` so the caller keeps its placeholder
		// dash on any failure.
		console.error('Failed to derive World Cup caller count', err);
	}
};
