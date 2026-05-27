<script lang="ts">
	import ConsensusCompass from '$lib/components/market/ConsensusCompass.svelte';
	import FlowCardBack from '$lib/components/market/FlowCardBack.svelte';
	import MarketArtwork from '$lib/components/market/MarketArtwork.svelte';
	import SeededAvatarStack from '$lib/components/ui/SeededAvatarStack.svelte';
	import { VXP_DEFAULT_STAKE } from '$lib/constants/vxp-economy.constants';
	import { lookupWcMarketSubtitle } from '$lib/constants/wc-market-subtitles.constants';
	import { daysToKickoff } from '$lib/derived/featured-event.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import type { FlowAction, Market } from '$lib/types/market';
	import type { MarketMetadata } from '$lib/types/market-metadata';
	import type {
		CategoryAccuracySignal,
		FollowedLeanSignal,
		PriorCallSignal
	} from '$lib/types/market-signals';
	import { resolveFlowArtCategory, type FlowArtCategory } from '$lib/utils/flow-art.utils';
	import {
		consensusPercent,
		consensusSide,
		formatWhyNowChip
	} from '$lib/utils/flow-card-display.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { tagColor } from '$lib/utils/tag-color.utils';
	import { vxpStakeSliderUnlocked } from '$lib/utils/vxp-economy.utils';

	interface Props {
		market: Market;
		onAction: (action: FlowAction) => void;
		signedIn: boolean;
		tradeAmount: string;
		interactive?: boolean;
		// When true, the parent has paused the deck (e.g. a sheet is
		// open) and the card desaturates / dims its faces.
		locked?: boolean;
		// Generative-artwork category. FlowMode resolves this from the
		// market's primary tag; FlowCard treats it as opaque and falls back
		// to a hash-derived bucket when the market has no tags.
		category?: FlowArtCategory | string;
		// Optional editorial sub-line ("FOMC · rate-cut call"). When
		// undefined, FlowCard derives a short fallback from the description.
		subtitle?: string;
		// When set, the card has already been committed to a side and is
		// playing the commit-feedback beat before the parent unmounts it.
		// The matching swipe overlay locks to full opacity.
		committedAction?: FlowAction | null;
		metadata?: MarketMetadata;
		categoryAcc?: CategoryAccuracySignal;
		priorCall?: PriorCallSignal;
		followedLean?: FollowedLeanSignal;
		// Stake-ladder change callback. Wired through to FlowCardBack so a
		// tap on a rung writes back to FlowMode's bound stake.
		onStakeChange?: (next: string) => void;
	}

	const {
		market,
		onAction,
		signedIn,
		tradeAmount,
		interactive = true,
		locked = false,
		category,
		subtitle,
		committedAction = null,
		metadata,
		categoryAcc,
		priorCall,
		followedLean,
		onStakeChange
	}: Props = $props();

	const isCommitted = $derived(committedAction !== null);

	// Swipe physics — rotation damping of 18 (drag.x / 18), commit
	// threshold of 100 px, settle delay of 220 ms after pointer-up
	// before the trade fires, vibrate 12 ms on commit.
	const SWIPE_THRESHOLD = 100;
	const SKIP_THRESHOLD = 110;
	const SETTLE_MS = 220;
	const VIBRATE_MS = 12;
	const TAP_PX = 6;

	// Resolved category — single source of truth across the surface so
	// untagged markets hash identically here, in FlowMode, etc.
	const resolvedCategory: FlowArtCategory = $derived(
		resolveFlowArtCategory({ categoryId: category, seed: market.id })
	);
	const catColor = $derived(tagColor(resolvedCategory));

	// Both faces are always rendered; an opacity crossfade swaps which
	// is visible (no true-3D `rotateY` flip).
	let flipped = $state(false);

	// Drag state — raw deltas, no Spring. Plain `{x, y, dragging}`
	// model with a `committedRef` one-shot latch reset on market
	// change so a fast double-swipe can't fire twice.
	let dragX = $state(0);
	let dragY = $state(0);
	let dragging = $state(false);
	let settling = $state(false);
	let startX = 0;
	let startY = 0;
	let movedDist = 0;
	let committedRef = false;

	const rotation = $derived(dragX / 18);
	const yesOpacity = $derived(Math.min(1, Math.max(0, dragX / 100)));
	const noOpacity = $derived(Math.min(1, Math.max(0, -dragX / 100)));
	const skipOpacity = $derived(Math.min(1, Math.max(0, -dragY / 90)));

	const overlayYes = $derived(committedAction === 'YES' ? 1 : yesOpacity);
	const overlayNo = $derived(committedAction === 'NO' ? 1 : noOpacity);
	const overlaySkip = $derived(committedAction === 'SKIP' ? 1 : skipOpacity);

	const crowdPct = $derived(consensusPercent(market));
	const crowdSide = $derived(consensusSide(market));
	const yesIsFav = $derived(crowdPct >= 50);
	const noPct = $derived(100 - crowdPct);

	// Payout preview — stake/(probability) − stake, clamped at p=0.05
	// to keep long-shots from rendering pathological numbers.
	const stakeNum = $derived(Math.max(0, Number(tradeAmount) || 0));
	const probMyYes = $derived(Math.max(0.05, market.yesProbability));
	const probMyNo = $derived(Math.max(0.05, 1 - market.yesProbability));
	const winYes = $derived(Math.max(1, Math.round(stakeNum / probMyYes) - stakeNum));
	const winNo = $derived(Math.max(1, Math.round(stakeNum / probMyNo) - stakeNum));

	// Stake selector unlock — hide the SIZE chip and the back-face stake
	// slider for first-time predictors (<50 calls). Below the threshold
	// the card forces `VXP_DEFAULT_STAKE` so they never see a number.
	const totalTrades = $derived($userStore.profile?.totalTrades ?? 0);
	const stakingUnlocked = $derived(vxpStakeSliderUnlocked({ calls: totalTrades }));
	const sizeStake = $derived(
		stakingUnlocked ? Math.max(VXP_DEFAULT_STAKE, stakeNum) : VXP_DEFAULT_STAKE
	);

	// Live countdown — days until expiry, displayed as a chip in the
	// meta row. Computed off `expiryDate` (ms). Urgency tiers:
	// ≤ 1 day = urgent, ≤ 7 = soon.
	const daysLeft = $derived.by(() => {
		const ms = Number(market.expiryDate) - Date.now();

		if (!Number.isFinite(ms) || ms <= 0) {
			return 0;
		}

		return Math.max(0, Math.ceil(ms / 86_400_000));
	});
	const daysLeftUrgency = $derived(daysLeft <= 1 ? 'urgent' : daysLeft <= 7 ? 'soon' : '');

	// WC live-state suffix on the category tag — only event-named
	// milestones (MATCHDAY, KICKS OFF TOMORROW, KICKOFF WK). The numeric
	// "X DAYS" suffix is owned by the days-left chip alongside.
	const wcSuffixKey = $derived.by<
		'wc.matchday' | 'wc.kicks_off_tomorrow' | 'wc.kickoff_week' | undefined
	>(() => {
		if (resolvedCategory !== 'wc') {
			return;
		}

		const dtk = $daysToKickoff;

		if (dtk == null) {
			return 'wc.matchday';
		}

		if (dtk <= 1) {
			return 'wc.kicks_off_tomorrow';
		}

		if (dtk <= 7) {
			return 'wc.kickoff_week';
		}
	});

	// Friends-followed-lean line — when the user is following predictors
	// who've called this market, surface the YES/NO split. Falls back to
	// the predictors-count + momentum delta line.
	const followedYes = $derived(followedLean?.yes);
	const followedTotal = $derived(followedLean?.total ?? 10);
	const followedNo = $derived(
		followedYes !== undefined ? Math.max(0, followedTotal - followedYes) : undefined
	);
	const followedLeanText = $derived.by(() => {
		if (followedYes === undefined || followedNo === undefined) {
			return '';
		}

		const friendLabel = t({
			locale: $localeStore,
			key: followedYes === 1 ? 'card.followed_friend_singular' : 'card.followed_friend_plural'
		});

		return t({
			locale: $localeStore,
			key: 'card.followed_lean_template',
			params: {
				yesLabel: `${followedYes} ${friendLabel}`,
				noLabel: String(followedNo)
			}
		});
	});
	const predictorsCount = $derived(
		market.outcomes?.reduce((acc, o) => acc + (o.totalPredictions ?? 0), 0) ?? 0
	);

	// Per-market momentum delta — deterministic per market.id, drives
	// the "+N today" fallback line shown when the user has no
	// followed-friends data on this market. Range ~10..99 keeps the
	// number plausible without requiring a live aggregator.
	const momentumDelta = $derived.by(() => {
		const id = String(market.id);
		let hash = 0;

		for (let i = 0; i < id.length; i += 1) {
			hash = (hash * 31 + id.charCodeAt(i)) | 0;
		}

		return (Math.abs(hash) % 90) + 10;
	});

	// Callers-in-last-hour placeholder — deterministic per market.id so
	// the count is stable across renders without a live presence service.
	// Range ~200..900 keeps the pill plausible at low-traffic moments
	// without feeling padded. Suppressed when a curated `metadata.whyNow`
	// already supplies a richer line.
	const callersLastHour = $derived.by(() => {
		const id = String(market.id);
		let hash = 0;

		for (let i = 0; i < id.length; i += 1) {
			hash = (hash * 31 + id.charCodeAt(i)) | 0;
		}

		return 200 + (Math.abs(hash) % 700);
	});

	const showPriorOnFront = $derived(Boolean(priorCall));
	const whyNowText = $derived(formatWhyNowChip(metadata?.whyNow));

	// Subtitle resolution order:
	//   1. Explicit `subtitle` prop (parent override)
	//   2. `metadata.subtitle` from the satellite (admin-curated)
	//   3. Curated WC-market lookup (`wc-market-subtitles.constants.ts`)
	//      — fallback for the tentpole markets the deck ships with
	//   4. undefined → row is hidden
	//
	// The raw `market.description` is intentionally NOT used as a
	// fallback. It's long, prose-shaped, and belongs under
	// RESOLVES YES IF on the back card. Surfacing it here as
	// truncated italic ("YES if that date is the hottest daily
	// maximum tem…") reads as a snippet rather than an editorial
	// accent.
	const subtitleText = $derived(
		subtitle ?? metadata?.subtitle ?? lookupWcMarketSubtitle(market.id)
	);

	// Per-card reset: clear flip + latch + drag whenever the market
	// underneath changes (parent re-uses the slot during deck shuffle).
	$effect(() => {
		market.id;
		flipped = false;
		dragX = 0;
		dragY = 0;
		dragging = false;
		committedRef = false;
	});

	const vibrate = (ms: number) => {
		if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
			try {
				navigator.vibrate(ms);
			} catch {
				// no-op
			}
		}
	};

	const fire = (side: FlowAction) => {
		if (committedRef) {
			return;
		}

		committedRef = true;
		onAction(side);
	};

	const isInteractiveTarget = (target: EventTarget | null): boolean => {
		const el = target as HTMLElement | null;

		if (el === null) {
			return false;
		}

		return Boolean(el.closest('button, a, input, textarea, select, [data-no-card-gesture]'));
	};

	const onPointerDown = (e: MouseEvent | TouchEvent) => {
		if (!interactive || isCommitted) {
			return;
		}

		if (isInteractiveTarget(e.target)) {
			return;
		}

		const p = 'touches' in e ? e.touches[0] : e;
		startX = p.clientX;
		startY = p.clientY;
		movedDist = 0;
		dragging = true;
		settling = false;
	};

	const onPointerMove = (e: MouseEvent | TouchEvent) => {
		if (!dragging) {
			return;
		}

		const p = 'touches' in e ? e.touches[0] : e;
		const dx = p.clientX - startX;
		const dy = p.clientY - startY;
		movedDist = Math.max(movedDist, Math.hypot(dx, dy));

		if (flipped) {
			// Back of card: only react to clearly horizontal motion —
			// vertical scroll belongs to the panel body.
			if (Math.abs(dx) > Math.abs(dy) * 1.2 && Math.abs(dx) > 8) {
				dragX = dx;
				dragY = 0;
			}

			return;
		}

		dragX = dx;
		dragY = dy;
	};

	const commitWithSettle = ({
		side,
		exitX,
		exitY
	}: {
		side: FlowAction;
		exitX: number;
		exitY: number;
	}) => {
		dragX = exitX;
		dragY = exitY;
		dragging = false;
		settling = true;
		vibrate(VIBRATE_MS);
		setTimeout(() => fire(side), SETTLE_MS);
	};

	const onPointerUp = () => {
		if (!dragging) {
			return;
		}

		dragging = false;
		settling = true;

		if (flipped) {
			// Back of card: tap returns to front; horizontal swipe still
			// commits a call; vertical motion (a scroll attempt) just
			// snaps the card back.
			if (movedDist < TAP_PX) {
				dragX = 0;
				dragY = 0;
				flipped = false;

				return;
			}

			if (dragX > SWIPE_THRESHOLD) {
				commitWithSettle({ side: 'YES', exitX: 600, exitY: 0 });

				return;
			}

			if (dragX < -SWIPE_THRESHOLD) {
				commitWithSettle({ side: 'NO', exitX: -600, exitY: 0 });

				return;
			}

			dragX = 0;
			dragY = 0;

			return;
		}

		if (movedDist < TAP_PX) {
			// Tap = flip to depth.
			dragX = 0;
			dragY = 0;
			flipped = true;

			return;
		}

		// Swipe-up SKIP takes priority when motion is clearly vertical.
		if (dragY < -SKIP_THRESHOLD && Math.abs(dragX) < Math.abs(dragY) * 0.7) {
			commitWithSettle({ side: 'SKIP', exitX: dragX, exitY: -700 });

			return;
		}

		if (dragX > SWIPE_THRESHOLD) {
			commitWithSettle({ side: 'YES', exitX: 600, exitY: dragY });

			return;
		}

		if (dragX < -SWIPE_THRESHOLD) {
			commitWithSettle({ side: 'NO', exitX: -600, exitY: dragY });

			return;
		}

		dragX = 0;
		dragY = 0;
	};

	const closeBack = () => {
		flipped = false;
	};

	const closeBackOnTap = (e: MouseEvent) => {
		// Tap anywhere on the back panel returns to the front, except
		// when the tap lands on an interactive control (those use
		// `stopPropagation` or `[data-no-card-gesture]`).
		if (isInteractiveTarget(e.target)) {
			return;
		}

		flipped = false;
	};

	const headBackground = $derived(
		`linear-gradient(160deg, color-mix(in srgb, ${catColor} 18%, transparent) 0%, color-mix(in srgb, ${catColor} 7%, transparent) 60%, transparent 100%)`
	);
	const headBorder = $derived(`color-mix(in srgb, ${catColor} 22%, transparent)`);
	const backBackground = $derived(
		`linear-gradient(180deg, color-mix(in srgb, ${catColor} 14%, transparent), transparent 60%), linear-gradient(180deg, var(--bg-popover), var(--bg-surface))`
	);
</script>

<div class="flow-card-root" role="presentation">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		style:transform="translate3d({dragX}px, {dragY}px, 0) rotate({rotation}deg)"
		style:transition={settling ? 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none'}
		style:cursor={interactive ? (flipped ? 'default' : 'grab') : 'default'}
		class="flow-card"
		class:is-committed={isCommitted}
		class:is-flipped={flipped}
		class:is-grabbing={dragging}
		class:is-locked={locked}
		class:is-static={!interactive}
		onmousedown={onPointerDown}
		onmouseleave={onPointerUp}
		onmousemove={onPointerMove}
		onmouseup={onPointerUp}
		ontouchend={onPointerUp}
		ontouchmove={onPointerMove}
		ontouchstart={onPointerDown}
	>
		<!-- ── FRONT FACE ─────────────────────────────────────── -->
		<div
			style:opacity={flipped ? 0 : 1}
			style:pointer-events={flipped ? 'none' : 'auto'}
			style:transition={`opacity 180ms cubic-bezier(0.22, 1, 0.36, 1) ${flipped ? '0ms' : '180ms'}`}
			style:--cat-color={catColor}
			class="flow-face flow-face-front"
			aria-hidden={flipped}
		>
			<header
				style:background={headBackground}
				style:border-bottom-color={headBorder}
				class="flow-head"
			>
				<div class="flow-head-row">
					<div class="flow-head-tags">
						<span style:color={catColor} class="flow-cat-tag allcaps">
							{resolvedCategory}
							{#if wcSuffixKey}
								<span class="flow-cat-live">
									· {t({ locale: $localeStore, key: wcSuffixKey })}
								</span>
							{/if}
						</span>
						{#if daysLeft > 0}
							<span
								class="flow-days num"
								class:is-soon={daysLeftUrgency === 'soon'}
								class:is-urgent={daysLeftUrgency === 'urgent'}
								aria-label={t({
									locale: $localeStore,
									key: 'card.days_left_aria',
									params: { days: daysLeft }
								})}
							>
								{daysLeft}d
							</span>
						{/if}
					</div>
					<ConsensusCompass size={42} yesProbability={market.yesProbability} />
				</div>

				{#if showPriorOnFront && priorCall}
					<p
						class="flow-whynow flow-whynow-prior"
						class:is-no={priorCall.side === 'NO'}
						class:is-yes={priorCall.side === 'YES'}
					>
						<span class="flow-whynow-dot" aria-hidden="true"></span>
						{t({ locale: $localeStore, key: 'card.you_called_eyebrow' })}
						<strong>{priorCall.side}</strong> · {priorCall.when}
					</p>
				{:else if whyNowText}
					<p class="flow-whynow">
						<span class="flow-whynow-dot" aria-hidden="true"></span>
						{whyNowText}
					</p>
				{/if}

				<h2 class="flow-card-title">{market.title}</h2>
				{#if subtitleText}
					<p class="flow-card-sub serif-italic acc">{subtitleText}</p>
				{/if}

				<!-- Live callers pill — green-dot live indicator + dynamic
				     count. Suppressed when a `priorCall` eyebrow or a
				     curated `metadata.whyNow` line already occupies the
				     same beat above the title. Until a live presence
				     service ships, the count is a deterministic
				     placeholder hashed off `market.id` so the value is
				     stable across renders. -->
				{#if !showPriorOnFront && !whyNowText}
					<span class="flow-callers-live num">
						<span class="flow-callers-dot" aria-hidden="true"></span>
						{t({
							locale: $localeStore,
							key: 'card.callers_last_hour',
							params: { count: callersLastHour }
						})}
					</span>
				{/if}
			</header>

			<div class="flow-body">
				<!-- Friends social proof + live momentum. The avatar
				     stack always renders (4 seeded decorative circles);
				     the trailing text swaps between
				       (a) `N friends YES · M NO`        — followedLean
				       (b) `K predicting · +D today`      — predictors-count fallback
				       (c) empty                          — neither available -->
				<div class="flow-social num">
					<SeededAvatarStack borderColor="var(--bg-popover)" size={18} />
					{#if followedYes !== undefined && followedYes > 0}
						<span class="flow-followed-lean">{followedLeanText}</span>
					{:else if predictorsCount > 0}
						<span>
							{t({
								locale: $localeStore,
								key: 'card.predicting_count',
								params: { count: predictorsCount.toLocaleString() }
							})}
							<span class="flow-momentum-sep" aria-hidden="true">·</span>
							<span class="flow-momentum-delta text-yes">
								{t({
									locale: $localeStore,
									key: 'card.momentum_delta',
									params: { count: momentumDelta }
								})}
							</span>
						</span>
					{/if}
				</div>

				<!-- Edge-to-edge market artwork. No padding around the
				     frame — extends across the card body (`bleed` mode). -->
				<div class="flow-art-bleed">
					<MarketArtwork
						bleed
						category={resolvedCategory}
						seed={market.id}
						size={420}
						state="neutral"
					/>
				</div>

				<!-- Probability split — single bar with payout labels.
				     Replaces the dual-box layout to compress space and
				     surface upside without the misleading red 85% box. -->
				<div class="flow-probs">
					<div class="flow-probs-row">
						<div class="flow-probs-side flow-probs-side-no">
							<span class="flow-probs-pct num">{noPct}%</span>
							<span class="flow-probs-label text-no">NO</span>
						</div>
						<div class="flow-probs-track" aria-hidden="true">
							<div style:width="{noPct}%" class="flow-probs-fill-no"></div>
							<div style:width="{crowdPct}%" class="flow-probs-fill-yes"></div>
						</div>
						<div class="flow-probs-side flow-probs-side-yes">
							<span class="flow-probs-label text-yes">YES</span>
							<span class="flow-probs-pct num">{crowdPct}%</span>
						</div>
					</div>
					<div class="flow-probs-action-row">
						<div class="flow-probs-action flow-probs-action-no">
							<span class="flow-probs-arrow text-no" aria-hidden="true">←</span>
							<span class="flow-probs-payout num">
								+{winNo}
								<span class="flow-probs-payout-unit">VXP</span>
							</span>
							<span class="flow-probs-role allcaps">
								{yesIsFav
									? t({ locale: $localeStore, key: 'card.long_shot' })
									: t({ locale: $localeStore, key: 'card.favorite' })}
							</span>
						</div>
						<div class="flow-probs-action flow-probs-action-yes">
							<span class="flow-probs-role allcaps">
								{yesIsFav
									? t({ locale: $localeStore, key: 'card.favorite' })
									: t({ locale: $localeStore, key: 'card.long_shot' })}
							</span>
							<span class="flow-probs-payout num">
								+{winYes}
								<span class="flow-probs-payout-unit">VXP</span>
							</span>
							<span class="flow-probs-arrow text-yes" aria-hidden="true">→</span>
						</div>
					</div>
				</div>

				<!-- Foot — SIZE · VXP (when staking is unlocked) + tap hint.
				     For first-time predictors the SIZE chip is hidden so
				     they never see the stake number on the front face. -->
				<div class="flow-foot num">
					{#if stakingUnlocked}
						<span class="flow-foot-size">
							{t({
								locale: $localeStore,
								key: 'card.size_vxp',
								params: { stake: sizeStake }
							})}
						</span>
					{:else}
						<span class="flow-foot-size flow-foot-size-locked">
							{t({
								locale: $localeStore,
								key: 'card.size_vxp',
								params: { stake: VXP_DEFAULT_STAKE }
							})}
						</span>
					{/if}
					<span class="flow-foot-hint allcaps">
						{t({ locale: $localeStore, key: 'card.tap_depth' })}
					</span>
				</div>
			</div>

			<!-- Full-card swipe overlays — large YES/NO/SKIP text
			     overlays that fade in with drag progress. -->
			<div
				style:opacity={signedIn ? overlayYes : overlayYes * 0.5}
				class="flow-overlay flow-overlay-yes"
				aria-hidden="true"
			>
				{t({ locale: $localeStore, key: 'flow.action.yes' })}
			</div>
			<div
				style:opacity={signedIn ? overlayNo : overlayNo * 0.5}
				class="flow-overlay flow-overlay-no"
				aria-hidden="true"
			>
				{t({ locale: $localeStore, key: 'flow.action.no' })}
			</div>
			<div style:opacity={overlaySkip} class="flow-overlay flow-overlay-skip" aria-hidden="true">
				{t({ locale: $localeStore, key: 'flow.action.skip' })}
			</div>
		</div>

		<!-- ── BACK FACE ─────────────────────────────────────── -->
		<div
			style:opacity={flipped ? 1 : 0}
			style:pointer-events={flipped ? 'auto' : 'none'}
			style:transition={`opacity 180ms cubic-bezier(0.22, 1, 0.36, 1) ${flipped ? '180ms' : '0ms'}`}
			style:background={backBackground}
			style:--cat-color={catColor}
			class="flow-face flow-face-back"
			aria-hidden={!flipped}
			onclick={closeBackOnTap}
		>
			<FlowCardBack
				category={resolvedCategory}
				{categoryAcc}
				{crowdPct}
				{crowdSide}
				{followedLean}
				interactive={flipped}
				{market}
				{metadata}
				onClose={closeBack}
				{onStakeChange}
				{priorCall}
				{tradeAmount}
			/>

			<!-- Back-face swipe still commits a call — horizontal stamps
			     mirror the front overlays. -->
			<div
				style:opacity={signedIn ? overlayYes : overlayYes * 0.5}
				class="flow-overlay flow-overlay-yes flow-overlay-back"
				aria-hidden="true"
			>
				{t({ locale: $localeStore, key: 'flow.action.yes' })}
			</div>
			<div
				style:opacity={signedIn ? overlayNo : overlayNo * 0.5}
				class="flow-overlay flow-overlay-no flow-overlay-back"
				aria-hidden="true"
			>
				{t({ locale: $localeStore, key: 'flow.action.no' })}
			</div>
		</div>
	</div>
</div>

<style lang="postcss">
	.flow-card-root {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		/* The 3D context the inner faces render against. We don't
		   apply a `rotateY` (the flip is opacity-only) but the
		   perspective still subtly affects subpixel rendering during
		   the crossfade — without it the swap can read flatter. */
		perspective: 1400px;
	}

	.flow-card {
		position: relative;
		width: 100%;
		height: 100%;
		user-select: none;
		/* `touch-action: none` keeps tap detection snappy: the browser
		   doesn't wait for a scroll-intent threshold before firing the
		   pointer events that drive drag / tap-to-flip. The back face's
		   own scrollable body sets its own `touch-action: pan-y` so
		   vertical scroll there still works. */
		touch-action: none;
		will-change: transform;
	}
	.flow-card.is-grabbing {
		cursor: grabbing !important;
	}
	.flow-card.is-static {
		cursor: default;
	}
	.flow-card.is-committed {
		cursor: default;
		pointer-events: none;
	}

	/* Locked state — parent (e.g. FlowMode) flips `locked` when a sheet
	   is open and gestures should pause. Both faces desaturate / dim. */
	.flow-card.is-locked .flow-face {
		filter: brightness(0.92) saturate(0.9);
		transition: filter 280ms var(--ease-vici);
	}

	/* Both faces share the same absolutely-positioned slot. Opacity
	   drives which is visible — no `rotateY`. The delayed-opacity
	   pattern keeps the back from flashing through the front during
	   the swap (see inline `transition` on each face). The
	   wrapper's `perspective` above keeps the swap rendering with
	   the same depth context as a true 3D flip. */
	.flow-face {
		position: absolute;
		inset: 0;
		overflow: hidden;
		/* 22 px corner radius — softer than the default card radius
		   for the swipeable Flow surface. */
		border-radius: 22px;
	}

	.flow-face-front {
		display: flex;
		flex-direction: column;
		background:
			radial-gradient(
				circle at 18% 0%,
				color-mix(in srgb, var(--cat-color) 18%, transparent),
				transparent 32%
			),
			linear-gradient(180deg, var(--bg-popover), var(--bg-surface));
		border: 1px solid var(--border-strong);
		box-shadow:
			0 12px 24px rgba(0, 0, 0, 0.3),
			0 32px 60px rgba(0, 0, 0, 0.2);
	}

	.flow-head {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 1.1rem 1.1rem 1rem;
		border-bottom: 1px solid var(--border-base);
	}

	.flow-head-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.flow-head-tags {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.flow-cat-tag {
		display: inline-flex;
		align-items: center;
		padding: 2px 8px;
		border-radius: var(--r-pill);
		background: rgba(242, 236, 220, 0.06);
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
	}

	.flow-cat-live {
		margin-left: 4px;
		font-size: 9.5px;
		letter-spacing: 0.12em;
		opacity: 0.85;
	}

	.flow-days {
		display: inline-flex;
		align-items: center;
		padding: 2px 7px;
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 88%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
	}
	.flow-days.is-soon {
		color: var(--cat-color);
		border-color: color-mix(in srgb, var(--cat-color) 30%, var(--border-base));
	}
	.flow-days.is-urgent {
		color: var(--no);
		border-color: color-mix(in srgb, var(--no) 30%, var(--border-base));
		animation: flow-days-pulse 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
	}
	@media (prefers-reduced-motion: reduce) {
		.flow-days.is-urgent {
			animation: none;
		}
	}

	.flow-whynow {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin: 0;
		padding: 0.3rem 0.55rem;
		border-radius: var(--r-pill);
		border: 1px solid color-mix(in srgb, var(--cat-color) 22%, var(--border-base));
		background: color-mix(in srgb, var(--cat-color) 10%, var(--bg-surface));
		font-size: var(--t-12);
		color: var(--laurel);
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}
	.flow-whynow strong {
		font-weight: 700;
	}
	.flow-whynow-prior.is-yes {
		color: var(--yes);
		border-color: color-mix(in srgb, var(--yes) 30%, var(--border-base));
	}
	.flow-whynow-prior.is-no {
		color: var(--no);
		border-color: color-mix(in srgb, var(--no) 30%, var(--border-base));
	}
	.flow-whynow-dot {
		width: 6px;
		height: 6px;
		border-radius: var(--r-pill);
		background: currentColor;
		flex-shrink: 0;
	}

	.flow-card-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.35rem, 5.6vw, 1.75rem);
		line-height: var(--leading-snug);
		font-weight: 600;
		letter-spacing: var(--tracking-snug);
		color: var(--text-base);
		overflow-wrap: anywhere;
	}

	.flow-card-sub {
		margin: 0;
		font-size: var(--t-14);
		line-height: var(--leading-normal);
		color: var(--text-muted);
		/* Serif-italic accent — editorial sub-row. The global
		   `.serif-italic` utility also sets font-family + weight; this
		   duplicates a few props so the typography still reads when the
		   utility class is overridden by parent context. */
		font-family: var(--font-serif);
		font-style: italic;
		font-weight: 400;
	}

	.flow-momentum-sep {
		margin: 0 5px;
		opacity: 0.55;
	}
	.flow-momentum-delta {
		font-weight: 700;
	}

	/* Live callers pill — green-dot live indicator + dynamic count.
	   Sits below the title/subtitle as the "why this card now" beat
	   when no curated whyNow or priorCall has already claimed that
	   slot. */
	.flow-callers-live {
		display: inline-flex;
		align-self: flex-start;
		align-items: center;
		gap: 5px;
		margin: 4px 0 0;
		font-size: var(--t-11, 0.7rem);
		font-weight: 600;
		color: var(--yes);
		letter-spacing: 0.02em;
	}
	.flow-callers-dot {
		width: 6px;
		height: 6px;
		border-radius: var(--r-pill);
		background: var(--yes);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--yes) 22%, transparent);
		animation: flow-callers-pulse 1.6s ease-in-out infinite;
	}
	@keyframes flow-callers-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.45;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.flow-callers-dot {
			animation: none;
		}
	}

	.flow-body {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		flex: 1 1 auto;
		min-height: 0;
		padding: 0.7rem 0 0;
	}

	.flow-social {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 1.1rem;
		font-size: var(--t-12);
		color: var(--text-muted);
		letter-spacing: 0.02em;
	}

	.flow-followed-lean {
		font-weight: 600;
	}
	/* Edge-to-edge artwork frame — the FlowArtFrame's own rounded
	   corners come off so the body of the card hosts the art with no
	   side padding (`bleed` mode). The frame's height is fixed so the
	   title / probs row never reflow on layout changes. */
	.flow-art-bleed {
		position: relative;
		width: 100%;
		height: clamp(140px, 22vw, 172px);
		overflow: hidden;
		border-top: 1px solid var(--border-base);
		border-bottom: 1px solid var(--border-base);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.flow-art-bleed :global(.flow-art) {
		width: 100%;
		height: 100%;
		max-width: none;
		border-radius: 0;
		box-shadow: none;
	}
	.flow-art-bleed :global(.flow-art > svg),
	.flow-art-bleed :global(.flow-art svg) {
		width: 100%;
		height: 100%;
	}

	.flow-probs {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		margin: 0 1.1rem;
	}

	.flow-probs-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.6rem;
	}

	.flow-probs-side {
		display: inline-flex;
		align-items: baseline;
		gap: 5px;
	}
	.flow-probs-side-no {
		justify-content: flex-start;
	}
	.flow-probs-side-yes {
		justify-content: flex-end;
	}

	.flow-probs-pct {
		font-size: 1.45rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1;
		color: var(--text-base);
	}
	.flow-probs-label {
		font-size: var(--t-11, 0.7rem);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.flow-probs-track {
		position: relative;
		display: flex;
		height: 8px;
		border-radius: var(--r-pill);
		overflow: hidden;
		background: var(--border-base);
	}
	.flow-probs-fill-no {
		height: 100%;
		background: color-mix(in srgb, var(--no) 80%, transparent);
	}
	.flow-probs-fill-yes {
		height: 100%;
		background: color-mix(in srgb, var(--yes) 80%, transparent);
	}

	.flow-probs-action-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
		font-size: var(--t-12);
	}
	.flow-probs-action {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--text-muted);
	}
	.flow-probs-action-no {
		justify-content: flex-start;
	}
	.flow-probs-action-yes {
		justify-content: flex-end;
	}
	.flow-probs-arrow {
		font-size: var(--t-14);
		font-weight: 700;
		line-height: 1;
	}
	.flow-probs-payout {
		display: inline-flex;
		align-items: baseline;
		gap: 3px;
		font-weight: 700;
		color: var(--text-base);
	}
	.flow-probs-payout-unit {
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}
	.flow-probs-role {
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 0.12em;
		opacity: 0.75;
	}

	.flow-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: auto 1.1rem 1.1rem;
		padding-top: 0.5rem;
		font-size: var(--t-12);
		color: var(--text-muted);
		letter-spacing: 0.06em;
	}
	.flow-foot-size {
		font-weight: 700;
		letter-spacing: 0.1em;
	}
	.flow-foot-size-locked {
		opacity: 0.55;
	}
	.flow-foot-hint {
		letter-spacing: 0.14em;
		font-size: 10.5px;
		opacity: 0.7;
	}

	/* Full-card swipe overlays — large directional YES / NO / SKIP
	   labels that fade in with drag progress. The overlay text alone
	   carries the swipe intent; no edge-inset glow. */
	.flow-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-display);
		font-weight: 900;
		font-size: clamp(3.5rem, 14vw, 5rem);
		letter-spacing: 0.06em;
		pointer-events: none;
		transition: opacity 80ms linear;
		z-index: 20;
	}
	.flow-overlay-yes {
		color: var(--yes);
		text-shadow: 0 4px 18px color-mix(in srgb, var(--yes) 40%, transparent);
	}
	.flow-overlay-no {
		color: var(--no);
		text-shadow: 0 4px 18px color-mix(in srgb, var(--no) 40%, transparent);
	}
	.flow-overlay-skip {
		color: var(--text-muted);
		text-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
	}
	.flow-overlay-back {
		font-size: clamp(3rem, 12vw, 4.5rem);
		z-index: 25;
	}

	.flow-face-back {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border-strong);
		box-shadow:
			0 24px 52px rgba(0, 0, 0, 0.24),
			0 12px 24px rgba(0, 0, 0, 0.18);
	}
</style>
