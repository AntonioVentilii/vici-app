<script lang="ts">
	import { ZERO } from '$lib/constants/app.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import type { Position, ResolvedPosition } from '$lib/types/position';
	import { formatDate, formatToken } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		market: Market;
		positions: Position[];
		/**
		 * Resolved-position records for this market, sourced from the user's
		 * `Settled` event stream. Used as a fallback for "MY CALL" once the
		 * clearing canister has removed the live `Position` row at
		 * settlement. Optional so non-resolved-market call sites don't have
		 * to thread it through.
		 */
		resolvedForMarket?: ResolvedPosition[];
	}

	const { market, positions, resolvedForMarket = [] }: Props = $props();

	const { totalVolume, yesVolume, noVolume, expiryDate, token } = $derived(market);

	// Liquidity proxy = the smaller of the two book sides — that's the
	// depth a counter-trade can hit before pushing the other side. The
	// satellite doesn't expose a separate liquidity field today; until
	// it does we surface `min(yesVolume, noVolume)` under the `vol`
	// and `liq` labels.
	const liquidity = $derived(yesVolume < noVolume ? yesVolume : noVolume);

	const userActivePosition = $derived(
		positions.find((p) => p.marketId === market.id && p.netQty !== ZERO)
	);

	/**
	 * Recover the user's side from the resolution event stream when the
	 * live position is gone. Winners are direct: their side matches
	 * `market.outcome`. For binary losers the side is the opposite
	 * (well-defined: YES/NO is exclusive). Categorical losers stay
	 * unknown because a single Settled event can't disambiguate which
	 * losing outcome the user actually held.
	 */
	const resolvedMyCall = $derived.by((): string | null => {
		if (resolvedForMarket.length === 0) {
			return null;
		}

		const winner = resolvedForMarket.find((r) => r.result === 'won');

		if (winner !== undefined && winner.outcomeId !== undefined) {
			return winner.outcomeId;
		}

		if (market.payoffType === 'Binary' && market.outcome === 'YES') {
			return 'NO';
		}

		if (market.payoffType === 'Binary' && market.outcome === 'NO') {
			return 'YES';
		}

		return null;
	});

	const myCall = $derived(userActivePosition?.outcomeId ?? resolvedMyCall);

	const stats = $derived([
		{
			labelKey: 'market.detail.stats.volume' as const,
			value: formatToken({ value: totalVolume, unitName: token.decimals }),
			suffix: token.symbol,
			mute: false
		},
		{
			labelKey: 'market.detail.stats.liquidity' as const,
			value: formatToken({ value: liquidity, unitName: token.decimals }),
			suffix: token.symbol,
			mute: false
		},
		{
			labelKey: 'market.detail.stats.closes' as const,
			value: formatDate(expiryDate),
			suffix: '',
			mute: false
		},
		{
			labelKey: 'market.detail.stats.my_call' as const,
			value:
				myCall === 'YES'
					? t({ locale: $localeStore, key: 'outcome.yes' })
					: myCall === 'NO'
						? t({ locale: $localeStore, key: 'outcome.no' })
						: (myCall ?? '—'),
			suffix: '',
			mute: myCall === null
		}
	]);
</script>

<!-- 2×2 stats grid: VOLUME / LIQUIDITY / CLOSES / MY CALL. Mirrors
     `screens.jsx:253-259` — the fourth tile is muted when the user has
     no active position so the grid reads as "you haven't called yet"
     instead of an empty space. -->
<div class="market-stats-grid">
	{#each stats as stat (stat.labelKey)}
		<div class="market-stats-cell">
			<span class="market-stats-eyebrow">
				{t({ locale: $localeStore, key: stat.labelKey })}
			</span>
			<div class="market-stats-value-row">
				<span class="num market-stats-value" class:is-mute={stat.mute}>{stat.value}</span>
				{#if stat.suffix !== ''}
					<span class="market-stats-suffix">{stat.suffix}</span>
				{/if}
			</div>
		</div>
	{/each}
</div>

<style lang="postcss">
	.market-stats-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		padding: 0.25rem 1.25rem 0.75rem;
	}

	.market-stats-cell {
		min-width: 0;
		padding: 0.875rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		box-shadow: var(--inset-hi);
	}

	.market-stats-eyebrow {
		color: var(--text-muted);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.market-stats-value-row {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
		margin-top: 0.375rem;
	}

	.market-stats-value {
		overflow: hidden;
		color: var(--text-base);
		font-size: var(--t-16);
		font-weight: 600;
		letter-spacing: -0.01em;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.market-stats-value.is-mute {
		color: var(--text-muted);
	}

	.market-stats-suffix {
		color: var(--text-muted);
		font-size: var(--t-12);
		font-weight: 700;
	}
</style>
