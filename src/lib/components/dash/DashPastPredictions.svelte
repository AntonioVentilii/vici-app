<script lang="ts">
	/**
	 * Past predictions block — the standard dashboard's settled-call history
	 * with won / lost filter chips. Owns the filter state, the row shaping
	 * (from the uncapped resolved-position stream), and the row formatters.
	 * Class names live in `app.css`.
	 */
	import { Check, X } from '@lucide/svelte/icons';
	import { USD_DECIMALS, ZERO } from '$lib/constants/app.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import type { ResolvedPosition } from '$lib/types/position';
	import { decimalFixedValueToNumber } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { formatWholeVxpMagnitude } from '$lib/utils/playground-display.utils';
	import { inferResolvedOutcomeId } from '$lib/utils/resolved-position.utils';

	type PastFilter = 'all' | 'won' | 'lost';

	interface Props {
		resolvedRows: ResolvedPosition[];
		marketById: Map<string, Market>;
		wins: number;
		losses: number;
		settledTotal: number;
	}

	let { resolvedRows, marketById, wins, losses, settledTotal }: Props = $props();

	let pastFilter = $state<PastFilter>('all');

	// "Past predictions" row list. Reads from the uncapped clearing-event
	// stream and shapes each entry to the row template's expected fields.
	// Stays consistent with the chip counts — same source, same scope.
	const filteredHistory = $derived(
		resolvedRows
			.filter((row) => {
				if (pastFilter === 'won') {
					return row.result === 'won';
				}

				if (pastFilter === 'lost') {
					return row.result === 'lost';
				}

				return row.result !== 'neutral';
			})
			.map((row) => {
				const market = marketById.get(row.marketId);
				const outcomeId = inferResolvedOutcomeId({ resolved: row, market });
				const sideLabel =
					outcomeId === undefined
						? null
						: (market?.outcomes?.find((o) => o.id === outcomeId)?.title ?? outcomeId);

				return {
					marketId: row.marketId,
					settledAtMs: Number(row.timestampNs / 1_000_000n),
					win: row.result === 'won',
					sideLabel,
					realizedPnlUsd: row.realizedPnlUsd
				};
			})
	);

	const marketTitle = (marketId: string): string => marketById.get(marketId)?.title ?? marketId;

	const fmtRelativeShort = (ms: number): string => {
		const delta = Date.now() - ms;
		const minutes = Math.floor(delta / 60_000);

		if (minutes < 60) {
			return `${Math.max(1, minutes)}m`;
		}

		const hours = Math.floor(minutes / 60);

		if (hours < 24) {
			return `${hours}h`;
		}

		const days = Math.floor(hours / 24);

		return `${days}d`;
	};

	/**
	 * Past-prediction row PnL → "+240 VXP" / "−180 VXP". `pnlUsdMicroUnits`
	 * is the signed `cashflow_usd` carried on the `Settled` event in
	 * `USD_DECIMALS` units; converted via `decimalFixedValueToNumber` and
	 * formatted whole-VXP for the row chip. A real sub-1 favourite win reads
	 * "+<1 VXP" (via `formatWholeVxpMagnitude`) rather than a broken "+0".
	 */
	const fmtPastRowAmount = (pnlUsdMicroUnits: bigint): string => {
		const n = decimalFixedValueToNumber({ value: pnlUsdMicroUnits, decimals: USD_DECIMALS });
		const sign = n >= 0 ? '+' : '−';

		return `${sign}${formatWholeVxpMagnitude(n)} VXP`;
	};
</script>

<div class="dash-section">
	<div class="dash-section-eyebrow">
		<span>{t({ locale: $localeStore, key: 'dash.past.eyebrow' })}</span>
		<span class="see-all">
			{t({ locale: $localeStore, key: 'dash.past.total', params: { count: settledTotal } })}
		</span>
	</div>
	<div class="dash-filter-chips">
		<button class:active={pastFilter === 'all'} onclick={() => (pastFilter = 'all')} type="button">
			{t({ locale: $localeStore, key: 'dash.past.filter_all' })}
		</button>
		<button class:active={pastFilter === 'won'} onclick={() => (pastFilter = 'won')} type="button">
			{t({
				locale: $localeStore,
				key: 'dash.past.filter_won',
				params: { count: wins }
			})}
		</button>
		<button
			class:active={pastFilter === 'lost'}
			onclick={() => (pastFilter = 'lost')}
			type="button"
		>
			{t({
				locale: $localeStore,
				key: 'dash.past.filter_lost',
				params: { count: losses }
			})}
		</button>
	</div>
	<div>
		{#if filteredHistory.length === 0}
			<div class="dash-empty">{t({ locale: $localeStore, key: 'dash.past.empty' })}</div>
		{:else}
			{#each filteredHistory.slice(0, 8) as h (h.marketId + h.settledAtMs)}
				{@const won = h.win}
				{@const pnlPositive = h.realizedPnlUsd >= ZERO}
				<div class="dash-past-row">
					<span class="res" class:lost={!won} class:won>
						{#if won}
							<Check aria-hidden="true" size={11} strokeWidth={3} />
						{:else}
							<X aria-hidden="true" size={11} strokeWidth={3} />
						{/if}
					</span>
					<div>
						<div class="q">{marketTitle(h.marketId)}</div>
						<div class="ctx">
							{#if h.sideLabel !== null}
								{t({
									locale: $localeStore,
									key: 'dash.past.row_ctx_side_when',
									params: {
										side: h.sideLabel,
										when: fmtRelativeShort(h.settledAtMs)
									}
								})}
							{:else}
								{t({
									locale: $localeStore,
									key: 'dash.past.row_ctx_when',
									params: { when: fmtRelativeShort(h.settledAtMs) }
								})}
							{/if}
						</div>
					</div>
					<span class="delta-pct" class:delta-lost={!pnlPositive} class:delta-won={pnlPositive}>
						{fmtPastRowAmount(h.realizedPnlUsd)}
					</span>
				</div>
			{/each}
		{/if}
	</div>
</div>
