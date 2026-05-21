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
	const predictorsNow = $derived(
		market.outcomes?.reduce((acc, outcome) => acc + (outcome.totalPredictions ?? 0), 0) ?? 0
	);
	const sharpPct = $derived(yesPct);
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
	<div style:--cat-color={catColor} class="flow-back-panel" onclick={(e) => e.stopPropagation()}>
		<header class="flow-back-head">
			<span class="allcaps flow-back-cat">{category}</span>
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
				{#if predictorsNow > 0}
					· {predictorsNow.toLocaleString()} predicting
				{/if}
			</p>

			<section class="flow-back-block flow-resolution">
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

			<section class="flow-back-block flow-community">
				<div class="flow-community-top">
					<p class="eyebrow flow-back-label">Crowd split</p>
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

			<section class="flow-back-block flow-activity">
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
						<span style:width={`${100 - yesPct}%`} class="flow-split-no"></span>
						<span style:width={`${yesPct}%`} class="flow-split-yes"></span>
					</div>
				</div>
				<div class="flow-split-row">
					<div class="flow-split-meta">
						<span>Top accuracy</span>
						<span class="num">{sharpPct}% {crowdSide}</span>
					</div>
					<div class="flow-split-bar" role="presentation">
						<span style:width={`${100 - sharpPct}%`} class="flow-split-no"></span>
						<span style:width={`${sharpPct}%`} class="flow-split-yes"></span>
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
		background:
			radial-gradient(
				circle at 18% 0%,
				color-mix(in srgb, var(--cat-color) 18%, transparent),
				transparent 34%
			),
			linear-gradient(180deg, var(--bg-popover), var(--bg-surface));
		border: 1px solid var(--border-strong);
		border-radius: var(--r-12);
		box-shadow:
			var(--inset-hi),
			0 24px 52px rgba(0, 0, 0, 0.24);
	}

	.flow-back-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.95rem 1.1rem 0.45rem;
	}

	.flow-back-cat {
		font-size: var(--t-12);
		color: var(--cat-color);
	}

	.flow-back-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--bg-surface) 88%, transparent);
		color: var(--text-base);
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
	}

	.flow-back-scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding: 0 1.1rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.flow-back-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.15rem, 4.6vw, 1.45rem);
		line-height: var(--leading-snug);
		color: var(--text-base);
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

	.flow-resolution,
	.flow-community,
	.flow-activity,
	.flow-split-row,
	.flow-back-context {
		padding: 0.75rem;
		border-radius: var(--r-12);
		border: 1px solid var(--border-base);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		box-shadow: var(--inset-hi);
	}

	.flow-resolution {
		border-color: color-mix(in srgb, var(--cat-color) 20%, var(--border-base));
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
		color: var(--text-muted);
	}

	.flow-back-copy {
		color: var(--text-base);
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

	.flow-community-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.flow-back-pct {
		font-size: 2rem;
		font-weight: 600;
		letter-spacing: -0.04em;
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
		height: 7px;
		border-radius: var(--r-pill);
		overflow: hidden;
		background: var(--border-base);
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
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		border-color: color-mix(in srgb, var(--cat-color) 22%, var(--border-base));
		background:
			linear-gradient(90deg, color-mix(in srgb, var(--cat-color) 8%, transparent), transparent),
			color-mix(in srgb, var(--bg-surface) 90%, transparent);
	}
</style>
