<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import { ZERO } from '$lib/constants/app.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import type { Position, ResolvedPosition } from '$lib/types/position';
	import { formatLongDate, formatToken } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { marketBookLiquidity } from '$lib/utils/market.utils';
	import { inferResolvedOutcomeId } from '$lib/utils/resolved-position.utils';

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

	const { totalVolume, expiryDate, token } = $derived(market);

	// Liquidity = value resting at the top of the book (`marketBookLiquidity`),
	// reflecting the live maker quotes rather than a volume proxy. ZERO only
	// when neither side has a resting level, which reads as the "be first" cue.
	const liquidity = $derived(marketBookLiquidity(market));

	const userActivePosition = $derived(
		positions.find((p) => p.marketId === market.id && p.netQty !== ZERO)
	);

	/**
	 * Recover the user's side from the resolution event stream when the
	 * live position is gone. Inference rules — winners' exact side,
	 * binary losers' opposite side, categorical losers unknown — live
	 * in `inferResolvedOutcomeId` so they stay aligned with the
	 * Portfolio row helpers.
	 */
	const resolvedMyCall = $derived.by((): string | null => {
		if (resolvedForMarket.length === 0) {
			return null;
		}

		// Prefer a winner (they carry the exact outcomeId) so the helper
		// returns immediately; otherwise any entry works since the
		// binary-loser fallback only depends on `market.outcome`.
		const seed = resolvedForMarket.find((r) => r.result === 'won') ?? resolvedForMarket[0];

		return inferResolvedOutcomeId({ resolved: seed, market }) ?? null;
	});

	const myCall = $derived(userActivePosition?.outcomeId ?? resolvedMyCall);

	// Cold-start: a market with no real volume yet reads "New" instead of
	// "0 VXP", and the matching depth tile reads "Be first". Both use our
	// real volume fields — never a synthetic crowd. The "New" / "Be first"
	// copy is suppressed (suffix dropped, tile muted) so the grid frames
	// the empty market as an opportunity.
	const freshVolume = $derived(totalVolume === ZERO);
	const freshLiquidity = $derived(liquidity === ZERO);

	const stats = $derived([
		{
			labelKey: 'market.detail.stats.volume' as const,
			value: freshVolume
				? t({ locale: $localeStore, key: 'market.detail.stats.new' })
				: formatToken({ value: totalVolume, unitName: token.decimals }),
			suffix: freshVolume ? '' : token.symbol,
			mute: freshVolume
		},
		{
			labelKey: 'market.detail.stats.liquidity' as const,
			value: freshLiquidity
				? t({ locale: $localeStore, key: 'market.detail.stats.be_first' })
				: formatToken({ value: liquidity, unitName: token.decimals }),
			suffix: freshLiquidity ? '' : token.symbol,
			mute: freshLiquidity
		},
		{
			labelKey: 'market.detail.stats.closes' as const,
			value: formatLongDate({ date: expiryDate, locale: $localeStore }),
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
			mute: isNullish(myCall)
		}
	]);
</script>

<!-- 2×2 stats grid: VOLUME / LIQUIDITY / CLOSES / MY CALL.
     The fourth tile is muted when the user has
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
		font-size: var(--t-10);
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
		color: var(--text-base);
		font-size: var(--t-16);
		font-weight: 600;
		letter-spacing: var(--tracking-snug);
		/* Long values (e.g. `December 31, 2026` in the CLOSES tile)
		   wrap to multiple lines instead of truncating with an
		   ellipsis. Earlier `white-space: nowrap` + `text-overflow:
		   ellipsis` ate the year on every locale that produces a
		   double-digit day. */
		overflow-wrap: anywhere;
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
