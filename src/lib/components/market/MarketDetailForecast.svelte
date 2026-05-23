<script lang="ts">
	import IconSignalNo from '$lib/components/icons/IconSignalNo.svelte';
	import IconSignalYes from '$lib/components/icons/IconSignalYes.svelte';
	import FlowCardSparkline from '$lib/components/market/FlowCardSparkline.svelte';
	import ResolvedMarketPanel from '$lib/components/market/ResolvedMarketPanel.svelte';
	import TradeModal from '$lib/components/market/TradeModal.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market, OutcomeId } from '$lib/types/market';
	import { formatProbability, formatToken } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { getTimeRemaining } from '$lib/utils/market.utils';

	interface Props {
		market: Market;
		onOutcomeSelect?: (id: OutcomeId) => void;
		onPredictionPlaced?: () => void;
	}

	const { market, onOutcomeSelect, onPredictionPlaced }: Props = $props();

	let selectedOutcomeId = $state<OutcomeId | undefined>();

	const {
		yesProbability,
		noProbability,
		yesVolume,
		noVolume,
		payoffType,
		outcomes,
		status,
		token: { decimals: tokenDecimals }
	} = $derived(market);

	const isResolved = $derived(status === 'Resolved');
	const yesPercent = $derived(Math.min(100, Math.max(0, Math.round(yesProbability * 100))));
	const noPercent = $derived(100 - yesPercent);
	const crowdSide = $derived(yesProbability >= noProbability ? 'YES' : 'NO');
	const totalPredictions = $derived(
		outcomes?.reduce((acc, outcome) => acc + (outcome.totalPredictions ?? 0), 0) ?? 0
	);
	const timeRemaining = $derived(getTimeRemaining(market.expiryDate));
	const sortedOutcomes = $derived(
		[...(outcomes ?? [])].sort((a, b) => {
			const probDiff = (b.probability ?? 0) - (a.probability ?? 0);

			if (probDiff !== 0) {
				return probDiff;
			}

			return (a.title ?? '').localeCompare(b.title ?? '');
		})
	);

	const handleOutcomeSelect = (id: OutcomeId) => {
		if (isResolved) {
			return;
		}

		selectedOutcomeId = id;
		onOutcomeSelect?.(id);
	};
</script>

{#if selectedOutcomeId && !isResolved}
	<TradeModal
		{market}
		onClose={() => (selectedOutcomeId = undefined)}
		onPredictionPlaced={() => {
			selectedOutcomeId = undefined;
			onPredictionPlaced?.();
		}}
		selectedOutcome={selectedOutcomeId}
	/>
{/if}

<div class="forecast-shell">
	{#if isResolved}
		<ResolvedMarketPanel {market} />
	{:else if payoffType === 'Binary'}
		<section class="forecast-card">
			<div class="forecast-card-head">
				<div>
					<p class="eyebrow">{t({ locale: $localeStore, key: 'market.forecast.crowd_split' })}</p>
					<div class="forecast-hero-line">
						<span
							class="num forecast-hero-pct"
							class:text-no={crowdSide === 'NO'}
							class:text-yes={crowdSide === 'YES'}
						>
							{crowdSide === 'YES' ? yesPercent : noPercent}%
						</span>
						<span
							class="allcaps"
							class:text-no={crowdSide === 'NO'}
							class:text-yes={crowdSide === 'YES'}
						>
							{crowdSide}
						</span>
					</div>
				</div>
				<div class="forecast-countdown">
					<span class="allcaps">{t({ locale: $localeStore, key: 'market.forecast.closes' })}</span>
					<strong class="num">{timeRemaining}</strong>
				</div>
			</div>

			<div class="forecast-spark-card">
				<FlowCardSparkline accentColor="var(--laurel)" seed={market.id} {yesPercent} />
			</div>

			<div class="forecast-split-bar" role="presentation">
				<span style:width={`${noPercent}%`} class="forecast-split-no"></span>
				<span style:width={`${yesPercent}%`} class="forecast-split-yes"></span>
			</div>

			<div class="forecast-resolution">
				<p class="eyebrow">{t({ locale: $localeStore, key: 'market.forecast.resolution' })}</p>
				<p>
					{market.description ||
						t({ locale: $localeStore, key: 'market.forecast.resolution_fallback' })}
				</p>
			</div>

			<div class="forecast-actions">
				<div class="forecast-action-wrap">
					<BaseButton
						class="forecast-action forecast-action-yes"
						onclick={() => handleOutcomeSelect('YES')}
					>
						<span class="forecast-action-icon">
							<IconSignalYes size="28px" />
						</span>
						<span class="forecast-action-label">
							{t({ locale: $localeStore, key: 'market.forecast.predict_yes' })}
						</span>
						<span class="num forecast-action-pct">{formatProbability(yesProbability)}</span>
					</BaseButton>
					<div class="forecast-action-foot">
						<span class="forecast-dot forecast-dot-yes" aria-hidden="true"></span>
						<span>{t({ locale: $localeStore, key: 'market.forecast.instant_execution' })}</span>
					</div>
				</div>

				<div class="forecast-action-wrap">
					<BaseButton
						class="forecast-action forecast-action-no"
						onclick={() => handleOutcomeSelect('NO')}
					>
						<span class="forecast-action-icon">
							<IconSignalNo size="28px" />
						</span>
						<span class="forecast-action-label">
							{t({ locale: $localeStore, key: 'market.forecast.predict_no' })}
						</span>
						<span class="num forecast-action-pct">{formatProbability(noProbability)}</span>
					</BaseButton>
					<div class="forecast-action-foot">
						<span class="forecast-dot forecast-dot-no" aria-hidden="true"></span>
						<span>{t({ locale: $localeStore, key: 'market.forecast.secure_settlement' })}</span>
					</div>
				</div>
			</div>

			<div class="forecast-volume-grid">
				<div>
					<span class="allcaps">
						{t({ locale: $localeStore, key: 'market.forecast.yes_volume' })}
					</span>
					<strong class="num">
						{formatToken({ value: yesVolume, unitName: tokenDecimals })}
					</strong>
				</div>
				<div>
					<span class="allcaps">
						{t({ locale: $localeStore, key: 'market.forecast.no_volume' })}
					</span>
					<strong class="num">
						{formatToken({ value: noVolume, unitName: tokenDecimals })}
					</strong>
				</div>
				<div>
					<span class="allcaps"
						>{t({ locale: $localeStore, key: 'market.forecast.predicting' })}</span
					>
					<strong class="num">{totalPredictions.toLocaleString()}</strong>
				</div>
			</div>
		</section>
	{:else}
		<div class="space-y-3">
			<h3 class="text-muted-foreground px-2 text-xs font-bold tracking-widest uppercase">
				{t({ locale: $localeStore, key: 'market.forecast.select_outcome' })}
			</h3>

			<div class="space-y-3">
				{#each sortedOutcomes as outcome (outcome.id)}
					<BaseButton
						class="group border-border bg-card hover:border-primary/30 relative w-full overflow-hidden rounded-2xl border p-5 text-left transition-all hover:shadow-md active:scale-[0.99]"
						onclick={() => handleOutcomeSelect(outcome.id)}
					>
						<div class="relative z-10 flex items-center justify-between">
							<div class="space-y-1">
								<span class="text-foreground group-hover:text-primary block text-lg font-black">
									{outcome.title}
								</span>
								<div
									class="text-muted-foreground flex items-center gap-3 text-[10px] font-bold uppercase"
								>
									<span>
										{t({
											locale: $localeStore,
											key: 'market.forecast.predictions_count',
											params: { count: outcome.totalPredictions ?? 0 }
										})}
									</span>
									<span class="bg-border h-1 w-1 rounded-full" aria-hidden="true"></span>
									<span>
										{t({
											locale: $localeStore,
											key: 'market.forecast.pool',
											params: {
												amount: formatToken({
													value: outcome.volume ?? ZERO,
													unitName: tokenDecimals
												})
											}
										})}
									</span>
								</div>
							</div>

							<div class="text-right">
								<div
									class="bg-primary/10 text-primary inline-flex items-center rounded-lg px-3 py-1"
								>
									<span class="text-lg font-black">
										{formatProbability(outcome.probability ?? 0)}
									</span>
								</div>
							</div>
						</div>

						<div class="bg-foreground/5 absolute bottom-0 left-0 h-1 w-full">
							<div
								style="width: {(outcome.probability ?? 0) * 100}%"
								class="bg-primary h-full opacity-20 transition-all duration-700"
							></div>
						</div>
					</BaseButton>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style lang="postcss">
	.forecast-shell {
		width: 100%;
	}

	.forecast-card {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow: hidden;
		border: 1px solid var(--border-base);
		border-radius: 1.75rem;
		background:
			radial-gradient(circle at 12% 0%, var(--laurel-glow), transparent 34%),
			linear-gradient(180deg, var(--bg-popover), var(--bg-surface));
		box-shadow: var(--shadow-card);
		padding: 1rem;
	}

	.forecast-card-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.forecast-hero-line {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-top: 0.15rem;
	}

	.forecast-hero-pct {
		font-size: clamp(2.75rem, 15vw, 5.5rem);
		font-weight: 600;
		letter-spacing: -0.06em;
		line-height: 0.9;
	}

	.forecast-countdown {
		flex: 0 0 auto;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		padding: 0.65rem 0.75rem;
		text-align: right;
	}

	.forecast-countdown strong {
		display: block;
		margin-top: 0.15rem;
		color: var(--text-base);
		font-size: var(--t-13);
	}

	.forecast-spark-card,
	.forecast-resolution,
	.forecast-volume-grid > div {
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		box-shadow: var(--inset-hi);
	}

	.forecast-spark-card {
		padding: 0.75rem;
	}

	.forecast-split-bar {
		display: flex;
		height: 0.6rem;
		overflow: hidden;
		border-radius: var(--r-pill);
		background: var(--bg-surface);
	}

	.forecast-split-no,
	.forecast-split-yes {
		display: block;
		height: 100%;
		transition: width var(--d-enter) var(--ease-vici);
	}

	.forecast-split-no {
		background: var(--no);
	}

	.forecast-split-yes {
		background: linear-gradient(90deg, var(--yes-deep), var(--yes));
	}

	.forecast-resolution {
		padding: 0.85rem;
	}

	.forecast-resolution p {
		margin: 0;
	}

	.forecast-resolution p + p {
		margin-top: 0.35rem;
		color: var(--text-muted);
		font-size: var(--t-13);
		line-height: var(--leading-normal);
	}

	.forecast-actions {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.75rem;
	}

	.forecast-action-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	:global(.forecast-action) {
		display: flex !important;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		width: 100%;
		min-height: 8rem;
		border-radius: 1.25rem;
		border: 1px solid transparent;
		padding: 1rem;
		text-align: center;
		transition:
			transform var(--d-hover) var(--ease-vici),
			box-shadow var(--d-state) var(--ease-vici);
	}

	:global(.forecast-action:hover) {
		transform: translateY(-1px);
	}

	:global(.forecast-action:active) {
		transform: scale(0.99);
	}

	:global(.forecast-action-yes) {
		border-color: color-mix(in srgb, var(--yes) 42%, transparent);
		background: linear-gradient(180deg, var(--yes), var(--yes-deep));
		color: var(--ink);
		box-shadow: 0 18px 36px -24px var(--yes);
	}

	:global(.forecast-action-no) {
		border-color: color-mix(in srgb, var(--no) 42%, transparent);
		background: linear-gradient(180deg, var(--no), var(--no-deep));
		color: var(--ink);
		box-shadow: 0 18px 36px -24px var(--no);
	}

	:global(.forecast-action-icon) {
		display: flex;
		opacity: 0.76;
	}

	:global(.forecast-action-label) {
		color: rgba(14, 13, 11, 0.72);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	:global(.forecast-action-pct) {
		color: var(--ink);
		font-size: var(--t-32);
		font-weight: 700;
		letter-spacing: -0.04em;
		line-height: 1;
	}

	.forecast-action-foot {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		color: var(--text-muted);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.forecast-dot {
		width: 5px;
		height: 5px;
		border-radius: var(--r-pill);
	}

	.forecast-dot-yes {
		background: var(--yes);
	}

	.forecast-dot-no {
		background: var(--no);
	}

	.forecast-volume-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.forecast-volume-grid > div {
		min-width: 0;
		padding: 0.7rem;
	}

	.forecast-volume-grid strong {
		display: block;
		margin-top: 0.25rem;
		overflow: hidden;
		color: var(--text-base);
		font-size: var(--t-13);
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (min-width: 640px) {
		.forecast-card {
			padding: 1.25rem;
		}

		.forecast-actions {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
