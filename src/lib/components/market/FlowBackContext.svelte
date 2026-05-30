<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import type { CategoryAccuracySignal, PriorCallSignal } from '$lib/types/market-signals';
	import type { FlowArtCategory } from '$lib/utils/flow-art.utils';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		category: FlowArtCategory;
		yesPct: number;
		categoryAcc?: CategoryAccuracySignal;
		priorCall?: PriorCallSignal;
	}

	const { category, yesPct, categoryAcc, priorCall }: Props = $props();

	// Friends-followed accuracy line — shown when the user has any
	// followed predictors who've called this market.
	const categoryAccLine = $derived(
		categoryAcc !== undefined
			? {
					pct: Math.round(categoryAcc.accuracy * 100),
					calls: categoryAcc.calls,
					accGood: categoryAcc.accuracy >= 0.6
				}
			: undefined
	);

	// Prior-call drift: how far consensus has moved since the user
	// committed. Used by the prior-call section at the bottom.
	const priorDrift = $derived.by<number | undefined>(() => {
		if (priorCall === undefined || priorCall.consensusThen === undefined) {
			return;
		}

		return Math.round(yesPct - Math.round(priorCall.consensusThen * 100));
	});
</script>

{#if categoryAccLine}
	<p
		class="flow-back-track"
		class:flow-back-track-no={!categoryAccLine.accGood}
		class:flow-back-track-yes={categoryAccLine.accGood}
	>
		{t({
			locale: $localeStore,
			key: 'card.your_accuracy_line',
			params: {
				category,
				pct: categoryAccLine.pct,
				calls: categoryAccLine.calls
			}
		})}
	</p>
{/if}

{#if priorCall}
	<div class="flow-back-prior">
		<span class="eyebrow flow-back-label">
			{t({ locale: $localeStore, key: 'card.you_called_eyebrow' })}
		</span>
		<span class="flow-back-prior-line num">
			<span class={priorCall.side === 'YES' ? 'text-yes' : 'text-no'}>
				{priorCall.side}
			</span>
			{#if priorDrift !== undefined}
				<span class="flow-back-prior-dim">
					{t({
						locale: $localeStore,
						key: 'card.prior_call_drift',
						params: {
							when: priorCall.when,
							drift: `${priorDrift >= 0 ? '+' : ''}${priorDrift}`
						}
					})}
				</span>
			{:else}
				<span class="flow-back-prior-dim">· {priorCall.when}</span>
			{/if}
		</span>
	</div>
{/if}

<style lang="postcss">
	.flow-back-label {
		margin: 0;
		color: var(--text-muted);
	}

	.flow-back-track {
		margin: 0;
		font-size: var(--t-12);
		color: var(--text-muted);
	}
	.flow-back-track-yes {
		color: var(--yes);
	}
	.flow-back-track-no {
		color: var(--no);
	}

	.flow-back-prior {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 0.7rem;
		border-radius: var(--r-12);
		border: 1px solid color-mix(in srgb, var(--cat-color) 22%, var(--border-base));
		background:
			linear-gradient(90deg, color-mix(in srgb, var(--cat-color) 8%, transparent), transparent),
			color-mix(in srgb, var(--bg-surface) 90%, transparent);
	}
	.flow-back-prior-line {
		font-size: var(--t-12);
		font-weight: 700;
	}
	.flow-back-prior-dim {
		margin-left: 6px;
		opacity: 0.7;
		font-weight: 500;
	}
</style>
