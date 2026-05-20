<script lang="ts">
	import FlowCardSparkline from '$lib/components/market/FlowCardSparkline.svelte';
	import type { Market } from '$lib/types/market';
	import type { MarketMetadata } from '$lib/types/market-metadata';
	import type {
		CategoryAccuracySignal,
		FollowedLeanSignal,
		PriorCallSignal
	} from '$lib/types/market-signals';
	import { categoryColor } from '$lib/utils/category-color.utils';
	import type { FlowArtCategory } from '$lib/utils/flow-art.utils';
	import {
		consensusPercent,
		consensusSide,
		formatCategoryAccuracyLine,
		formatFlowCallsLabel,
		formatFollowedLeanLine,
		formatPriorCallLine,
		formatResolutionLine
	} from '$lib/utils/flow-card-display.utils';
	import { formatDate, formatProbability } from '$lib/utils/format.utils';
	import { getTimeRemaining } from '$lib/utils/market.utils';

	interface Props {
		market: Market;
		category: FlowArtCategory;
		metadata?: MarketMetadata;
		categoryAcc?: CategoryAccuracySignal;
		priorCall?: PriorCallSignal;
		followedLean?: FollowedLeanSignal;
		onClose: () => void;
	}

	const { market, category, metadata, categoryAcc, priorCall, followedLean, onClose }: Props =
		$props();

	const catColor = $derived(categoryColor(category));
	const yesPct = $derived(consensusPercent(market));
	const crowdSide = $derived(consensusSide(market));
	const callsLabel = $derived(
		formatFlowCallsLabel({ volume: market.totalVolume, decimals: market.token.decimals })
	);
	const resolution = $derived(formatResolutionLine(metadata?.resolution));
	const categoryAccLine = $derived(
		categoryAcc
			? formatCategoryAccuracyLine({ signal: categoryAcc, categoryLabel: category })
			: undefined
	);
	const followedLine = $derived(followedLean ? formatFollowedLeanLine(followedLean) : undefined);
	const priorLine = $derived(
		priorCall ? formatPriorCallLine({ signal: priorCall, consensusNowPct: yesPct }) : undefined
	);
	const hasUserContext = $derived(
		[categoryAccLine, followedLine, priorLine].some((line) => line !== undefined)
	);

	let rulesOpen = $state(false);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="flow-back" onclick={onClose}>
	<div class="flow-back-panel" onclick={(e) => e.stopPropagation()}>
		<header class="flow-back-head">
			<span style:color={catColor} class="allcaps flow-back-cat">{category}</span>
			<button
				class="flow-back-close"
				aria-label="Return to card front"
				onclick={onClose}
				type="button"
			>
				×
			</button>
		</header>

		<div class="flow-back-scroll">
			<h3 class="flow-back-title">{market.title}</h3>
			<p class="flow-back-meta num">
				Settles {formatDate(market.expiryDate)} · {getTimeRemaining(market.expiryDate)}
			</p>

			<section class="flow-back-block">
				<p class="eyebrow flow-back-label">Resolves yes if</p>
				<p class="flow-back-copy">{resolution.condition}</p>
				<p class="flow-back-source">
					Source: {resolution.source}
					{#if resolution.settlesLabel}
						· settles {resolution.settlesLabel}
					{/if}
				</p>
				<button
					class="flow-back-toggle"
					aria-expanded={rulesOpen}
					onclick={() => {
						rulesOpen = !rulesOpen;
					}}
					type="button"
				>
					{rulesOpen ? 'Hide full rules' : 'Show full rules'}
				</button>
				{#if rulesOpen}
					<p class="flow-back-rules">
						Resolution is final at trading close. Edge cases follow the source's official wording.
					</p>
				{/if}
			</section>

			<section class="flow-back-block">
				<div class="flow-back-community">
					<span
						class="num flow-back-pct"
						class:text-no={crowdSide === 'NO'}
						class:text-yes={crowdSide === 'YES'}
					>
						{formatProbability(market.yesProbability)}
						<span class="flow-back-side">{crowdSide}</span>
					</span>
				</div>
				<FlowCardSparkline
					accentColor={catColor}
					events={metadata?.events}
					seed={market.id}
					yesPercent={yesPct}
				/>
			</section>

			<section class="flow-back-block">
				<p class="eyebrow flow-back-label">Activity</p>
				<p class="flow-back-activity num">{callsLabel}</p>
			</section>

			<section class="flow-back-block">
				<p class="eyebrow flow-back-label">Who's calling what</p>
				<div class="flow-split-row">
					<div class="flow-split-meta">
						<span>All callers</span>
						<span class="num">{yesPct}%</span>
					</div>
					<div class="flow-split-bar" role="presentation">
						<span style:width="{100 - yesPct}%" class="flow-split-no"></span>
						<span style:width="{yesPct}%" class="flow-split-yes"></span>
					</div>
				</div>
				{#if followedLean}
					<div class="flow-split-row">
						<div class="flow-split-meta">
							<span>Predictors you follow</span>
							<span class="num">{followedLean.yes} of {followedLean.total} YES</span>
						</div>
						<div class="flow-follow-dots" aria-label={followedLine} role="img">
							{#each Array.from({ length: followedLean.total }, (_, i) => i) as i (i)}
								<span class="flow-follow-dot" class:is-yes={i < followedLean.yes}></span>
							{/each}
						</div>
					</div>
				{/if}
			</section>

			{#if hasUserContext}
				<section class="flow-back-context">
					<p class="eyebrow flow-back-label">Your context</p>
					{#if categoryAccLine}
						<p class="flow-back-context-line">{categoryAccLine}</p>
					{/if}
					{#if followedLine}
						<p class="flow-back-context-line">{followedLine}</p>
					{/if}
					{#if priorLine}
						<p class="flow-back-context-line">{priorLine}</p>
					{/if}
				</section>
			{/if}
		</div>
	</div>
</div>

<style lang="postcss">
	.flow-back {
		position: absolute;
		inset: 0;
		z-index: 30;
		display: flex;
		flex-direction: column;
		border-radius: var(--r-12);
		overflow: hidden;
	}

	.flow-back-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: linear-gradient(180deg, var(--bg-popover), var(--bg-surface));
		border: 1px solid var(--border-strong);
		border-radius: var(--r-12);
		box-shadow: var(--inset-hi);
	}

	.flow-back-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem 0.5rem;
	}

	.flow-back-cat {
		font-size: var(--t-12);
	}

	.flow-back-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		color: var(--parchment);
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
	}

	.flow-back-scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding: 0 1.25rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.flow-back-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.25rem;
		line-height: var(--leading-snug);
		color: var(--parchment);
	}

	.flow-back-meta {
		margin: 0;
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.flow-back-block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.flow-back-label {
		margin: 0;
		color: var(--text-muted);
	}

	.flow-back-copy,
	.flow-back-source,
	.flow-back-activity,
	.flow-back-context-line {
		margin: 0;
		font-size: var(--t-13);
		line-height: var(--leading-normal);
		color: var(--parchment-mute);
	}

	.flow-back-source {
		font-size: var(--t-12);
	}

	.flow-back-toggle {
		align-self: flex-start;
		border: none;
		background: none;
		padding: 0;
		font-size: var(--t-12);
		color: var(--laurel);
		cursor: pointer;
		text-decoration: underline;
	}

	.flow-back-rules {
		margin: 0;
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.flow-back-community {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.flow-back-pct {
		font-size: 1.75rem;
		font-weight: 600;
	}

	.flow-back-side {
		margin-left: 0.35rem;
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
	}

	.flow-split-row {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.flow-split-meta {
		display: flex;
		justify-content: space-between;
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.flow-split-bar {
		display: flex;
		height: 6px;
		border-radius: var(--r-pill);
		overflow: hidden;
		background: var(--ink-line);
	}

	.flow-split-no {
		display: block;
		height: 100%;
		background: var(--no-wash);
	}

	.flow-split-yes {
		display: block;
		height: 100%;
		background: var(--yes-wash);
	}

	.flow-follow-dots {
		display: flex;
		gap: 4px;
	}

	.flow-follow-dot {
		width: 8px;
		height: 8px;
		border-radius: var(--r-pill);
		background: var(--no-wash);
		border: 1px solid var(--no);
	}

	.flow-follow-dot.is-yes {
		background: var(--yes-wash);
		border-color: var(--yes);
	}

	.flow-back-context {
		padding: 0.75rem;
		border-radius: var(--r-8);
		border: 1px solid var(--border-base);
		background: var(--bg-surface);
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
</style>
