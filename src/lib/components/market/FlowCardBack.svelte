<script lang="ts">
	import ConsensusCompass from '$lib/components/market/ConsensusCompass.svelte';
	import FlowCardSparkline from '$lib/components/market/FlowCardSparkline.svelte';
	import SavedMarketToggle from '$lib/components/saved-markets/SavedMarketToggle.svelte';
	import {
		VXP_STAKE_LADDER,
		VXP_STAKE_UNLOCK_AT_CALLS,
		type VxpStake
	} from '$lib/constants/vxp-economy.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import type { Market } from '$lib/types/market';
	import type { MarketMetadata } from '$lib/types/market-metadata';
	import type {
		CategoryAccuracySignal,
		FollowedLeanSignal,
		PriorCallSignal
	} from '$lib/types/market-signals';
	import { isViciXp } from '$lib/utils/balance-domain.utils';
	import type { FlowArtCategory } from '$lib/utils/flow-art.utils';
	import {
		consensusPercent,
		consensusSide,
		formatCategoryAccuracyLine,
		formatFlowCallsLabel,
		formatFollowedLeanLine,
		formatPriorCallLine
	} from '$lib/utils/flow-card-display.utils';
	import { formatDate, formatProbability } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { getTimeRemaining } from '$lib/utils/market.utils';
	import { tagColor } from '$lib/utils/tag-color.utils';
	import {
		snapToStakeLadder,
		vxpNetWin,
		vxpStakeSliderUnlocked
	} from '$lib/utils/vxp-economy.utils';

	interface Props {
		market: Market;
		category: FlowArtCategory;
		metadata?: MarketMetadata;
		categoryAcc?: CategoryAccuracySignal;
		priorCall?: PriorCallSignal;
		followedLean?: FollowedLeanSignal;
		onClose: () => void;
		// Mirrors FlowCard.interactive: only the topmost card is wired
		// for the tap-to-flip-back gesture so background cards (which
		// the user can't see) don't react to stray events.
		interactive?: boolean;
		// Current stake amount (mirrors FlowCard.tradeAmount as a string
		// so the FlowMode → FlowCard → FlowCardBack chain shares one
		// source of truth). When undefined, the stake row is hidden.
		tradeAmount?: string;
		// Stake-ladder change callback. Fires when a rung is tapped on
		// the VXP stake slider; the parent updates its bound state and
		// passes the new value back on the next render.
		onStakeChange?: (next: string) => void;
	}

	const {
		market,
		category,
		metadata,
		categoryAcc,
		priorCall,
		followedLean,
		onClose,
		interactive = true,
		tradeAmount,
		onStakeChange
	}: Props = $props();

	// Tap = pointerdown + pointerup with raw movement under this many
	// pixels. Same threshold and intent as FlowCard's TAP_FLIP_PX, but
	// the raw deltas are used directly here (no spring lag) so scroll
	// gestures reliably exceed it and don't trigger a flip-back.
	const TAP_CLOSE_PX = 12;

	let tapStartX = 0;
	let tapStartY = 0;
	let tapTracking = false;

	const isInteractiveTarget = (target: EventTarget | null): boolean => {
		const el = target as HTMLElement | null;

		if (el === null) {
			return false;
		}

		// `[data-no-flip-back]` lets future markup (e.g. a chart, a
		// long-press copy region) opt out of tap-to-flip-back without
		// hard-coding selectors here.
		return Boolean(el.closest('button, a, input, textarea, select, [data-no-flip-back]'));
	};

	const onPanelDown = (e: MouseEvent | TouchEvent) => {
		if (!interactive || isInteractiveTarget(e.target)) {
			tapTracking = false;

			return;
		}

		const point = 'touches' in e ? e.touches[0] : e;
		tapStartX = point.clientX;
		tapStartY = point.clientY;
		tapTracking = true;
	};

	const onPanelUp = (e: MouseEvent | TouchEvent) => {
		if (!tapTracking) {
			return;
		}

		tapTracking = false;

		if (isInteractiveTarget(e.target)) {
			return;
		}

		const point = 'changedTouches' in e ? e.changedTouches[0] : e;
		const dx = Math.abs(point.clientX - tapStartX);
		const dy = Math.abs(point.clientY - tapStartY);

		if (dx < TAP_CLOSE_PX && dy < TAP_CLOSE_PX) {
			onClose();
		}
	};

	const cancelTap = () => {
		tapTracking = false;
	};

	const catColor = $derived(tagColor(category));
	const yesPct = $derived(consensusPercent(market));
	const crowdSide = $derived(consensusSide(market));
	const predictorsNow = $derived(
		market.outcomes?.reduce((acc, outcome) => acc + (outcome.totalPredictions ?? 0), 0) ?? 0
	);
	const sharpPct = $derived(yesPct);
	const callsLabel = $derived(
		formatFlowCallsLabel({ volume: market.totalVolume, decimals: market.token.decimals })
	);
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
	const resolutionCondition = $derived(market.description?.trim() ?? '');

	// VXP stake slider — exposed only on the VXP balance domain (the
	// playground domain uses fractional ICP / ckUSDC stakes via the
	// FlowMode +/- stepper, not the ladder), AND only after the user
	// has enough lifetime calls to unlock free stake choice (per
	// `VXP_STAKE_UNLOCK_AT_CALLS`). Pre-unlock the card forces
	// `VXP_DEFAULT_STAKE` so first-time predictors aren't asked to
	// pick a ladder rung. Snapping the parent's free-form
	// `tradeAmount` to the nearest ladder rung also defends against
	// persisted stake values from before the ladder shipped.
	const totalTrades = $derived($userStore.profile?.totalTrades ?? 0);
	const stakeSliderUnlocked = $derived(vxpStakeSliderUnlocked({ calls: totalTrades }));
	const showStakeSlider = $derived(
		tradeAmount !== undefined &&
			onStakeChange !== undefined &&
			isViciXp($balanceDomain) &&
			stakeSliderUnlocked
	);
	// Pre-unlock placeholder — shown when the user is on the VXP
	// domain but still under the calls threshold. Gives them
	// visibility into the upcoming unlock instead of just hiding the
	// row.
	const showStakeSliderLock = $derived(
		tradeAmount !== undefined &&
			onStakeChange !== undefined &&
			isViciXp($balanceDomain) &&
			!stakeSliderUnlocked
	);
	const stakeUnlockCallsLeft = $derived(Math.max(0, VXP_STAKE_UNLOCK_AT_CALLS - totalTrades));
	const currentStake: VxpStake = $derived(
		showStakeSlider ? snapToStakeLadder({ value: Number(tradeAmount ?? '0') || 0 }) : 50
	);
	const stakeYesWin = $derived(vxpNetWin({ stake: currentStake, pWin: market.yesProbability }));
	const stakeNoWin = $derived(vxpNetWin({ stake: currentStake, pWin: 1 - market.yesProbability }));

	const selectStake = (rung: VxpStake) => {
		if (onStakeChange === undefined) {
			return;
		}

		onStakeChange(String(rung));
	};
</script>

<div class="flow-back">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		style:--cat-color={catColor}
		class="flow-back-panel"
		onmousedown={onPanelDown}
		onmouseleave={cancelTap}
		onmouseup={onPanelUp}
		ontouchcancel={cancelTap}
		ontouchend={onPanelUp}
		ontouchstart={onPanelDown}
	>
		<header class="flow-back-head">
			<span class="allcaps flow-back-cat">{category}</span>
			<!-- Save / unsave from the swipe deck — the prototype puts
			     the heart on the card back face so users can bookmark a
			     market for later without committing a stake. Uses the
			     shared SavedMarketToggle so the bookmark state stays in
			     lockstep with MarketCard and MarketDetail. -->
			<div class="flow-back-actions">
				<SavedMarketToggle marketId={market.id} size="sm" />
			</div>
		</header>

		<div class="flow-back-scroll">
			<h3 class="flow-back-title">{market.title}</h3>
			<p class="flow-back-meta num">
				{t({
					locale: $localeStore,
					key: 'card.back.settles_line',
					params: {
						date: formatDate(market.expiryDate),
						timeRemaining: getTimeRemaining(market.expiryDate)
					}
				})}
				{#if predictorsNow > 0}
					·
					{t({
						locale: $localeStore,
						key: 'card.predicting_count',
						params: { count: predictorsNow.toLocaleString() }
					})}
				{/if}
			</p>

			{#if resolutionCondition.length > 0}
				<section class="flow-back-block flow-resolution">
					<p class="eyebrow flow-back-label">
						{t({ locale: $localeStore, key: 'card.back.resolves_if' })}
					</p>
					<p class="flow-back-copy">{resolutionCondition}</p>
					<button
						class="flow-back-toggle"
						aria-expanded={rulesOpen}
						onclick={() => {
							rulesOpen = !rulesOpen;
						}}
						type="button"
					>
						{rulesOpen
							? t({ locale: $localeStore, key: 'card.back.hide_rules' })
							: t({ locale: $localeStore, key: 'card.back.show_rules' })}
					</button>
					{#if rulesOpen}
						<p class="flow-back-rules">
							{t({ locale: $localeStore, key: 'card.back.rules_body' })}
						</p>
					{/if}
				</section>
			{/if}

			<section class="flow-back-block flow-community">
				<div class="flow-community-top">
					<div class="flow-community-text">
						<p class="eyebrow flow-back-label">
							{t({ locale: $localeStore, key: 'card.back.crowd_split' })}
						</p>
						<span
							class="num flow-back-pct"
							class:text-no={crowdSide === 'NO'}
							class:text-yes={crowdSide === 'YES'}
						>
							{formatProbability(market.yesProbability)}
							<span class="flow-back-side">{crowdSide}</span>
						</span>
					</div>
					<ConsensusCompass size={56} yesProbability={market.yesProbability} />
				</div>
				<FlowCardSparkline
					accentColor={catColor}
					events={metadata?.events}
					seed={market.id}
					yesPercent={yesPct}
				/>
			</section>

			<section class="flow-back-block flow-activity">
				<p class="eyebrow flow-back-label">
					{t({ locale: $localeStore, key: 'market.detail.tab.activity' })}
				</p>
				<p class="flow-back-activity num">{callsLabel}</p>
			</section>

			{#if showStakeSlider}
				<section class="flow-back-block flow-stake" data-no-flip-back>
					<p class="eyebrow flow-back-label">
						{t({ locale: $localeStore, key: 'card.back.stake_ladder' })}
					</p>
					<div class="flow-stake-rungs" role="radiogroup">
						{#each VXP_STAKE_LADDER as rung (rung)}
							<button
								class="flow-stake-rung num"
								class:is-active={rung === currentStake}
								aria-checked={rung === currentStake}
								onclick={() => selectStake(rung)}
								role="radio"
								type="button"
							>
								{rung}
							</button>
						{/each}
					</div>
					<div class="flow-stake-preview">
						<div class="flow-stake-cell">
							<span class="flow-stake-cell-label allcaps">
								{t({ locale: $localeStore, key: 'card.back.stake_yes_wins' })}
							</span>
							<span class="num text-yes">+{stakeYesWin}</span>
						</div>
						<div class="flow-stake-cell">
							<span class="flow-stake-cell-label allcaps">
								{t({ locale: $localeStore, key: 'card.back.stake_no_wins' })}
							</span>
							<span class="num text-no">+{stakeNoWin}</span>
						</div>
					</div>
				</section>
			{:else if showStakeSliderLock}
				<section class="flow-back-block flow-stake flow-stake-locked" data-no-flip-back>
					<p class="eyebrow flow-back-label">
						{t({ locale: $localeStore, key: 'card.back.stake_ladder' })}
					</p>
					<p class="flow-stake-locked-hint">
						{t({
							locale: $localeStore,
							key: 'card.back.stake_locked',
							params: { left: stakeUnlockCallsLeft, threshold: VXP_STAKE_UNLOCK_AT_CALLS }
						})}
					</p>
				</section>
			{/if}

			<section class="flow-back-block">
				<p class="eyebrow flow-back-label">
					{t({ locale: $localeStore, key: 'card.back.who_calling' })}
				</p>
				<div class="flow-split-row">
					<div class="flow-split-meta">
						<span>{t({ locale: $localeStore, key: 'card.back.all_callers' })}</span>
						<span class="num">{yesPct}%</span>
					</div>
					<div class="flow-split-bar" role="presentation">
						<span style:width={`${100 - yesPct}%`} class="flow-split-no"></span>
						<span style:width={`${yesPct}%`} class="flow-split-yes"></span>
					</div>
				</div>
				<div class="flow-split-row">
					<div class="flow-split-meta">
						<span>{t({ locale: $localeStore, key: 'card.back.top_accuracy' })}</span>
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
							<span>{t({ locale: $localeStore, key: 'card.back.predictors_you_follow' })}</span>
							<span class="num">
								{t({
									locale: $localeStore,
									key: 'card.back.followed_count',
									params: { count: followedLean.yes, total: followedLean.total }
								})}
							</span>
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
					<p class="eyebrow flow-back-label">
						{t({ locale: $localeStore, key: 'card.back.your_context' })}
					</p>
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
		/* Mirrors the grab cursor on `.flow-card` so the back reads as
		   one continuous tappable surface. Buttons and the scrollable
		   detail body override this with their own cursors. */
		cursor: grab;
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
		gap: 0.5rem;
		padding: 0.95rem 1.1rem 0.45rem;
	}

	.flow-back-cat {
		font-size: var(--t-12);
		color: var(--cat-color);
	}

	.flow-back-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
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
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.flow-community-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
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

	.flow-stake {
		gap: 0.6rem;
	}

	.flow-stake-rungs {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.35rem;
	}

	.flow-stake-rung {
		appearance: none;
		padding: 0.45rem 0;
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		cursor: pointer;
		transition:
			color 120ms ease,
			background 120ms ease,
			border-color 120ms ease;
	}

	.flow-stake-rung:hover {
		color: var(--text-base);
	}

	.flow-stake-rung.is-active {
		color: var(--cat-color);
		background: color-mix(in srgb, var(--cat-color) 14%, transparent);
		border-color: color-mix(in srgb, var(--cat-color) 38%, var(--border-base));
	}

	.flow-stake-preview {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.flow-stake-cell {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.5rem 0.6rem;
		border-radius: var(--r-12);
		border: 1px solid var(--border-base);
		background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
	}

	.flow-stake-cell-label {
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
	}

	.flow-stake-locked-hint {
		margin: 0;
		padding: 0.55rem 0.7rem;
		font-size: var(--t-12);
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
		border: 1px dashed var(--border-base);
		border-radius: var(--r-12);
	}
</style>
