<script lang="ts">
	import { Share2 } from 'lucide-svelte/icons';
	import FlowCardSparkline from '$lib/components/market/FlowCardSparkline.svelte';
	import SharePopover from '$lib/components/market/SharePopover.svelte';
	import SavedMarketToggle from '$lib/components/saved-markets/SavedMarketToggle.svelte';
	import { VXP_STAKE_LADDER, type VxpStake } from '$lib/constants/vxp-economy.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { CallSide, Market } from '$lib/types/market';
	import type { MarketMetadata } from '$lib/types/market-metadata';
	import type {
		CategoryAccuracySignal,
		FollowedLeanSignal,
		PriorCallSignal
	} from '$lib/types/market-signals';
	import { isViciXp } from '$lib/utils/balance-domain.utils';
	import type { FlowArtCategory } from '$lib/utils/flow-art.utils';
	import { formatProbability } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { tagColor } from '$lib/utils/tag-color.utils';
	import { snapToStakeLadder, vxpNetWin } from '$lib/utils/vxp-economy.utils';

	interface Props {
		market: Market;
		category: FlowArtCategory;
		// Crowd-side derived state piped down from FlowCard so the front
		// and back read off the same numbers (avoids two `derived`
		// computations diverging on float rounding).
		crowdPct: number;
		crowdSide: CallSide;
		metadata?: MarketMetadata;
		categoryAcc?: CategoryAccuracySignal;
		priorCall?: PriorCallSignal;
		followedLean?: FollowedLeanSignal;
		onClose: () => void;
		// Mirrors FlowCard.interactive — only the topmost card is wired
		// for the tap-to-flip-back / horizontal-swipe-commits gestures.
		interactive?: boolean;
		// Current stake amount (string for input-binding parity with
		// FlowMode). Drives the stake slider and payout preview.
		tradeAmount?: string;
		// Stake-ladder change callback. Fires when a rung or the
		// native range input changes.
		onStakeChange?: (next: string) => void;
	}

	const {
		market,
		category,
		crowdPct,
		crowdSide,
		metadata,
		categoryAcc,
		priorCall,
		followedLean,
		onClose,
		interactive = true,
		tradeAmount,
		onStakeChange
	}: Props = $props();

	const catColor = $derived(tagColor(category));
	const yesPct = $derived(crowdPct);
	const noPct = $derived(100 - yesPct);

	// Live countdown — minute-tick interval. Only runs while this back
	// panel is mounted (Svelte cleans up the timer on destroy). 60 s is
	// fine: the label tier doesn't shift faster than a minute.
	let nowTick = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => {
			nowTick = Date.now();
		}, 60_000);

		return () => clearInterval(id);
	});

	// Long-form settlement date — "July 19, 2026", locale-aware via
	// `toLocaleDateString({ month: 'long', day: 'numeric', year:
	// 'numeric' })`. Replaces the default short `MM/DD/YYYY` format
	// so the meta row reads as editorial copy rather than a stamp.
	const longSettleDate = $derived(
		new Date(Number(market.expiryDate)).toLocaleDateString($localeStore, {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		})
	);

	// Computed *live* countdown — recomputes on each minute tick.
	// `getTimeRemaining` already produces "Xd Yh remaining" / "Xh Ym
	// remaining" / "Xm remaining" / "Expired"; we strip the trailing
	// noun and swap to the shorter "Nd left" / "Nh left" / "Nm left"
	// form for the compact meta row.
	const liveCountdown = $derived.by(() => {
		nowTick; // touch so the derived re-runs on tick
		const ms = Number(market.expiryDate) - Date.now();

		if (!Number.isFinite(ms) || ms <= 0) {
			return t({ locale: $localeStore, key: 'card.back.countdown_closing' });
		}

		const days = Math.floor(ms / 86_400_000);
		const hours = Math.floor((ms % 86_400_000) / 3_600_000);
		const mins = Math.floor((ms % 3_600_000) / 60_000);

		if (days >= 1) {
			return t({
				locale: $localeStore,
				key: 'card.back.countdown_days_left',
				params: { count: days }
			});
		}

		if (hours >= 1) {
			return t({
				locale: $localeStore,
				key: 'card.back.countdown_hours_left',
				params: { count: hours }
			});
		}

		return t({
			locale: $localeStore,
			key: 'card.back.countdown_minutes_left',
			params: { count: mins }
		});
	});
	const countdownUrgent = $derived.by(() => {
		nowTick;
		const ms = Number(market.expiryDate) - Date.now();

		return ms > 0 && ms <= 86_400_000;
	});

	// Sharp-predictor lean — `sharpPct = min(95, yes + 10)` keeps the
	// top-decile band leaning 10pp further than consensus, capped at 95.
	const sharpPct = $derived(Math.min(95, yesPct + 10));
	const sharpDiff = $derived(sharpPct - yesPct);

	const predictorsCount = $derived(
		market.outcomes?.reduce((acc, outcome) => acc + (outcome.totalPredictions ?? 0), 0) ?? 0
	);

	const resolutionCondition = $derived(market.description?.trim() ?? '');
	let rulesOpen = $state(false);

	// VXP stake slider — exposed on the VXP balance domain only (the
	// playground domain uses fractional ICP / ckUSDC stakes via the
	// FlowMode stepper, not the ladder).
	const showStakeSlider = $derived(
		tradeAmount !== undefined && onStakeChange !== undefined && isViciXp($balanceDomain)
	);
	const currentStake: VxpStake = $derived(
		showStakeSlider ? snapToStakeLadder({ value: Number(tradeAmount ?? '0') || 0 }) : 50
	);
	const stakeIdx = $derived(VXP_STAKE_LADDER.indexOf(currentStake));
	const stakePct = $derived(stakeIdx >= 0 ? (stakeIdx / (VXP_STAKE_LADDER.length - 1)) * 100 : 0);
	const atCap = $derived(currentStake === VXP_STAKE_LADDER[VXP_STAKE_LADDER.length - 1]);
	const stakeYesWin = $derived(vxpNetWin({ stake: currentStake, pWin: market.yesProbability }));
	const stakeNoWin = $derived(vxpNetWin({ stake: currentStake, pWin: 1 - market.yesProbability }));

	const selectStake = (rung: VxpStake) => {
		if (onStakeChange === undefined) {
			return;
		}

		onStakeChange(String(rung));
	};

	const onStakeRangeChange = (e: Event) => {
		const target = e.target as HTMLInputElement;
		const idx = parseInt(target.value, 10);
		const rung = VXP_STAKE_LADDER[idx];

		if (rung !== undefined) {
			selectStake(rung);
		}
	};

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

	// Share popover toggle — anchored above the share button. The
	// popover handles native / clipboard / channel paths itself; this
	// component owns just the open/close state and the toast we show
	// on successful clipboard copy.
	let shareOpen = $state(false);

	const toggleShare = () => {
		shareOpen = !shareOpen;
	};

	const onCopied = () => {
		notificationsStore.add({
			title: t({ locale: $localeStore, key: 'market.detail.share.copied_title' }),
			message: t({ locale: $localeStore, key: 'market.detail.share.copied' }),
			type: 'success'
		});
	};
</script>

<div style:--cat-color={catColor} class="flow-back">
	<header class="flow-back-head">
		<span class="allcaps flow-back-cat">{category}</span>
		<div class="flow-back-actions" data-no-card-gesture="true">
			<SavedMarketToggle marketId={market.id} size="sm" />
			<button
				class="flow-back-share"
				aria-label={t({ locale: $localeStore, key: 'market.detail.share.label' })}
				onclick={toggleShare}
				type="button"
			>
				<Share2 aria-hidden="true" size={16} strokeWidth={1.8} />
			</button>
			{#if shareOpen}
				<SharePopover
					{market}
					onClose={() => (shareOpen = false)}
					{onCopied}
					priorCall={priorCall ? { side: priorCall.side } : null}
				/>
			{/if}
		</div>
	</header>

	<div class="flow-back-scroll">
		<h3 class="flow-back-title">{market.title}</h3>
		<div class="flow-back-meta num">
			<span>
				{t({
					locale: $localeStore,
					key: 'card.back.settles_line',
					params: {
						date: longSettleDate,
						timeRemaining: liveCountdown
					}
				})}
			</span>
			{#if countdownUrgent}
				<span class="flow-back-countdown-pulse" aria-hidden="true"></span>
			{/if}
		</div>
		{#if predictorsCount > 0}
			<p class="flow-back-predicting num">
				{t({
					locale: $localeStore,
					key: 'card.predicting_count',
					params: { count: predictorsCount.toLocaleString() }
				})}
			</p>
		{/if}

		{#if resolutionCondition.length > 0}
			<section class="flow-back-block flow-resolution">
				<p class="eyebrow flow-back-label">
					{t({ locale: $localeStore, key: 'card.back.resolves_if' })}
				</p>
				<p class="flow-back-copy">{resolutionCondition}</p>
				<div class="flow-res-foot">
					<span class="flow-res-source">
						{t({ locale: $localeStore, key: 'card.back.source_official' })}
					</span>
					<button
						class="flow-back-toggle"
						aria-expanded={rulesOpen}
						data-no-card-gesture="true"
						onclick={(e) => {
							e.stopPropagation();
							rulesOpen = !rulesOpen;
						}}
						type="button"
					>
						{rulesOpen
							? t({ locale: $localeStore, key: 'card.back.hide_rules' })
							: t({ locale: $localeStore, key: 'card.back.show_rules' })}
						<span class="flow-back-toggle-caret" class:is-open={rulesOpen} aria-hidden="true">
							▾
						</span>
					</button>
				</div>
				{#if rulesOpen}
					<p class="flow-back-rules">
						{t({ locale: $localeStore, key: 'card.back.rules_body' })}
					</p>
				{/if}
			</section>
		{/if}

		<section class="flow-back-block flow-community">
			<div class="flow-community-top">
				<span class={`num flow-community-pct ${crowdSide === 'YES' ? 'text-yes' : 'text-no'}`}>
					{formatProbability(market.yesProbability)}
					<span class="flow-community-side">{crowdSide}</span>
				</span>
				<span
					class={`flow-community-delta num ${yesPct >= 50 ? 'flow-delta-yes' : 'flow-delta-no'}`}
				>
					{yesPct >= 50 ? '▲' : '▼'}
					{Math.abs(yesPct - Math.max(5, yesPct - 12))}% {t({
						locale: $localeStore,
						key: 'card.back.this_week'
					})}
				</span>
			</div>
			<FlowCardSparkline events={metadata?.events} seed={market.id} yesPercent={yesPct} />
		</section>

		{#if showStakeSlider}
			<section
				class={`flow-back-block flow-stake${atCap ? ' is-cap' : ''}`}
				data-no-card-gesture="true"
			>
				<div class="flow-stake-head">
					<span class="eyebrow flow-stake-label">
						{atCap
							? t({ locale: $localeStore, key: 'card.call_size_cap' })
							: t({ locale: $localeStore, key: 'card.call_size' })}
					</span>
					<span class="flow-stake-value num">
						{currentStake}
						<span class="flow-stake-unit">VXP</span>
					</span>
				</div>
				<div class="flow-stake-slider-wrap">
					<div class="flow-stake-track" aria-hidden="true">
						<div style:width="{stakePct}%" class="flow-stake-fill"></div>
					</div>
					<div style:left="{stakePct}%" class="flow-stake-handle" aria-hidden="true"></div>
					<input
						class="flow-stake-range"
						aria-label={t({ locale: $localeStore, key: 'card.call_size' })}
						max={VXP_STAKE_LADDER.length - 1}
						min={0}
						onchange={onStakeRangeChange}
						oninput={onStakeRangeChange}
						step={1}
						type="range"
						value={Math.max(0, stakeIdx)}
					/>
				</div>
				<div class="flow-stake-pegs" role="radiogroup">
					{#each VXP_STAKE_LADDER as rung (rung)}
						<button
							class="flow-stake-peg num"
							class:is-active={rung === currentStake}
							aria-checked={rung === currentStake}
							onclick={(e) => {
								e.stopPropagation();
								selectStake(rung);
							}}
							role="radio"
							type="button"
						>
							{rung}
						</button>
					{/each}
				</div>
				<div class="flow-stake-payout">
					<div class="flow-stake-payout-row">
						<span class="flow-stake-payout-lbl allcaps">
							{t({ locale: $localeStore, key: 'card.if_yes_at', params: { pct: yesPct } })}
						</span>
						<span class="num text-yes">+{stakeYesWin} VXP</span>
					</div>
					<div class="flow-stake-payout-row">
						<span class="flow-stake-payout-lbl allcaps">
							{t({ locale: $localeStore, key: 'card.if_no_at', params: { pct: noPct } })}
						</span>
						<span class="num text-yes">+{stakeNoWin} VXP</span>
					</div>
					<div class="flow-stake-payout-row">
						<span class="flow-stake-payout-lbl allcaps">
							{t({ locale: $localeStore, key: 'card.if_wrong' })}
						</span>
						<span class="num text-no">−{currentStake} VXP</span>
					</div>
				</div>
			</section>
		{/if}

		<!-- Three-row "Who's calling what" split — the differentiating
		     value of VICI's reputation layer. Row 1 = all callers, Row 2
		     = sharp predictors (with a +/- diff badge vs consensus), Row
		     3 = predictors you follow (dot grid). -->
		<section class="flow-back-block flow-split">
			<p class="eyebrow flow-back-label">
				{t({ locale: $localeStore, key: 'card.back.who_calling' })}
			</p>

			<div class="flow-split-row">
				<div class="flow-split-meta">
					<span class="flow-split-label">
						{t({ locale: $localeStore, key: 'card.back.all_callers' })}
					</span>
					<span class="flow-split-pct num">{yesPct}%</span>
				</div>
				<div class="flow-split-bar" role="presentation">
					<i style:width="{100 - yesPct}%" class="flow-split-fill-no"></i>
					<i style:width="{yesPct}%" class="flow-split-fill-yes"></i>
				</div>
			</div>

			<div class="flow-split-row">
				<div class="flow-split-meta">
					<span class="flow-split-label">
						{t({ locale: $localeStore, key: 'card.back.top_accuracy' })}
					</span>
					<span class="flow-split-pct num">{sharpPct}%</span>
					{#if sharpDiff !== 0}
						<span
							class="flow-split-badge num"
							class:is-negative={sharpDiff < 0}
							class:is-positive={sharpDiff > 0}
						>
							{t({
								locale: $localeStore,
								key: sharpDiff > 0 ? 'card.back.sharp_diff_ahead' : 'card.back.sharp_diff_behind',
								params: { count: Math.abs(sharpDiff) }
							})}
						</span>
					{/if}
				</div>
				<div class="flow-split-bar" role="presentation">
					<i style:width="{100 - sharpPct}%" class="flow-split-fill-no"></i>
					<i style:width="{sharpPct}%" class="flow-split-fill-yes"></i>
				</div>
			</div>

			{#if followedLean}
				<div class="flow-split-row">
					<div class="flow-split-meta">
						<span class="flow-split-label">
							{t({ locale: $localeStore, key: 'card.back.predictors_you_follow' })}
						</span>
						<span class="flow-split-pct num">
							{t({
								locale: $localeStore,
								key: 'card.back.followed_count',
								params: { count: followedLean.yes, total: followedLean.total }
							})}
						</span>
					</div>
					<div
						class="flow-followed-dots"
						aria-label={t({
							locale: $localeStore,
							key: 'card.back.followed_count',
							params: { count: followedLean.yes, total: followedLean.total }
						})}
						role="img"
					>
						{#each Array.from({ length: followedLean.total }, (_, i) => i) as i (i)}
							<span class="flow-followed-dot" class:is-yes={i < followedLean.yes}></span>
						{/each}
					</div>
				</div>
			{/if}
		</section>

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
	</div>

	{#if !interactive}
		<button
			class="flow-back-close-sr"
			aria-label={t({ locale: $localeStore, key: 'card.back.return_aria' })}
			onclick={onClose}
			type="button"
		></button>
	{/if}
</div>

<style lang="postcss">
	.flow-back {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		border-radius: var(--r-12);
		overflow: hidden;
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
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
	}

	.flow-back-actions {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	/* Share-pop anchor button — mirrors `MarketDetailShareButton` but
	   stays inline here because the popover is anchored relative to
	   `.flow-back-actions`, so the button can't take its own offset
	   parent. */
	.flow-back-share {
		display: inline-flex;
		width: 2.25rem;
		height: 2.25rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-surface);
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici),
			color var(--d-hover) var(--ease-vici);
	}
	.flow-back-share:hover {
		border-color: var(--border-strong);
		background: var(--bg-popover);
		color: var(--text-base);
	}

	.flow-back-scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding: 0 1.1rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.flow-back-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.15rem, 4.6vw, 1.45rem);
		line-height: var(--leading-snug);
		color: var(--text-base);
	}

	.flow-back-meta {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		margin: 0;
		font-size: var(--t-12);
		color: var(--text-muted);
	}
	.flow-back-meta-sep {
		opacity: 0.55;
	}

	/* Predictors count — its own row below `flow-back-meta` so the
	   meta line stays just `Settles {date} · {countdown}` (matches
	   the editorial rhythm where settlement and headcount are
	   distinct beats). */
	.flow-back-predicting {
		margin: 0;
		font-size: var(--t-12);
		color: var(--text-muted);
	}
	.flow-back-countdown-pulse {
		width: 6px;
		height: 6px;
		border-radius: var(--r-pill);
		background: var(--no);
		box-shadow: 0 0 0 0 color-mix(in srgb, var(--no) 60%, transparent);
		animation: countdownPulse 1.6s infinite;
	}
	@keyframes countdownPulse {
		0% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--no) 60%, transparent);
		}
		60% {
			box-shadow: 0 0 0 6px transparent;
		}
		100% {
			box-shadow: 0 0 0 0 transparent;
		}
	}

	.flow-back-block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.flow-resolution,
	.flow-community,
	.flow-stake,
	.flow-split {
		padding: 0.75rem 0.85rem;
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
	.flow-back-rules {
		margin: 0;
		font-size: var(--t-13);
		line-height: var(--leading-normal);
		color: var(--text-base);
	}
	.flow-back-rules {
		color: var(--text-muted);
		padding-top: 0.4rem;
		border-top: 1px solid var(--border-base);
		margin-top: 0.4rem;
	}

	.flow-res-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 0.35rem;
	}
	.flow-res-source {
		font-size: var(--t-12);
		color: var(--text-muted);
		opacity: 0.85;
	}

	.flow-back-toggle {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border: none;
		background: none;
		padding: 0;
		font-size: var(--t-12);
		color: var(--laurel);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.flow-back-toggle-caret {
		font-size: 11px;
		transition: transform 160ms ease;
	}
	.flow-back-toggle-caret.is-open {
		transform: rotate(180deg);
	}

	.flow-community-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.flow-community-pct {
		font-size: 2.05rem;
		font-weight: 600;
		letter-spacing: -0.03em;
		line-height: 1;
	}
	.flow-community-side {
		margin-left: 0.35rem;
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
	}
	.flow-community-delta {
		font-size: var(--t-12);
		font-weight: 700;
	}
	.flow-delta-yes {
		color: var(--yes);
	}
	.flow-delta-no {
		color: var(--no);
	}

	.flow-stake.is-cap {
		border-color: color-mix(in srgb, var(--cat-color) 40%, var(--border-base));
	}
	.flow-stake-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}
	.flow-stake-label {
		color: var(--text-muted);
	}
	.flow-stake-value {
		font-size: var(--t-16);
		font-weight: 700;
		color: var(--text-base);
	}
	.flow-stake-unit {
		font-size: 9.5px;
		letter-spacing: 0.12em;
		color: var(--text-muted);
		font-weight: 700;
		margin-left: 3px;
	}

	.flow-stake-slider-wrap {
		position: relative;
		height: 22px;
		margin: 0.4rem 0 0.3rem;
	}
	.flow-stake-track {
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		transform: translateY(-50%);
		height: 6px;
		border-radius: var(--r-pill);
		background: var(--border-base);
		overflow: hidden;
	}
	.flow-stake-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--cat-color), var(--laurel));
		border-radius: inherit;
	}
	.flow-stake-handle {
		position: absolute;
		top: 50%;
		width: 14px;
		height: 14px;
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		border: 2px solid var(--cat-color);
		transform: translate(-50%, -50%);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
		pointer-events: none;
	}
	.flow-stake-range {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
		margin: 0;
	}

	.flow-stake-pegs {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.35rem;
	}
	.flow-stake-peg {
		appearance: none;
		padding: 0.4rem 0;
		font-size: var(--t-12);
		font-weight: 700;
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
	.flow-stake-peg:hover {
		color: var(--text-base);
	}
	.flow-stake-peg.is-active {
		color: var(--cat-color);
		background: color-mix(in srgb, var(--cat-color) 14%, transparent);
		border-color: color-mix(in srgb, var(--cat-color) 38%, var(--border-base));
	}

	.flow-stake-payout {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-base);
		margin-top: 0.4rem;
	}
	.flow-stake-payout-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: var(--t-12);
	}
	.flow-stake-payout-lbl {
		color: var(--text-muted);
		font-size: 10px;
		letter-spacing: 0.1em;
	}

	.flow-split-row {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.35rem 0;
	}
	.flow-split-row + .flow-split-row {
		border-top: 1px solid var(--border-base);
	}
	.flow-split-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px;
		font-size: var(--t-12);
		color: var(--text-muted);
	}
	.flow-split-label {
		flex: 1 1 auto;
		color: var(--text-base);
		font-weight: 500;
	}
	.flow-split-pct {
		font-weight: 700;
		color: var(--text-base);
	}
	.flow-split-badge {
		font-size: 9.5px;
		letter-spacing: 0.08em;
		padding: 1px 6px;
		border-radius: var(--r-pill);
		border: 1px solid var(--border-base);
		background: var(--bg-surface);
	}
	.flow-split-badge.is-positive {
		color: var(--yes);
		border-color: color-mix(in srgb, var(--yes) 30%, var(--border-base));
	}
	.flow-split-badge.is-negative {
		color: var(--no);
		border-color: color-mix(in srgb, var(--no) 30%, var(--border-base));
	}

	.flow-split-bar {
		display: flex;
		height: 7px;
		border-radius: var(--r-pill);
		overflow: hidden;
		background: var(--border-base);
	}
	.flow-split-fill-no {
		display: block;
		height: 100%;
		background: color-mix(in srgb, var(--no) 75%, transparent);
	}
	.flow-split-fill-yes {
		display: block;
		height: 100%;
		background: color-mix(in srgb, var(--yes) 75%, transparent);
	}

	.flow-followed-dots {
		display: flex;
		gap: 4px;
	}
	.flow-followed-dot {
		width: 9px;
		height: 9px;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--no-wash) 70%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}
	.flow-followed-dot.is-yes {
		background: color-mix(in srgb, var(--yes-wash) 70%, transparent);
		border-color: color-mix(in srgb, var(--yes) 45%, var(--border-base));
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

	.flow-back-close-sr {
		position: absolute;
		left: -9999px;
		top: 0;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}
</style>
