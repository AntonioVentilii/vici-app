<script lang="ts">
	import { Spring } from 'svelte/motion';
	import FlowArtFrame from '$lib/components/artwork/FlowArtFrame.svelte';
	import FlowCardBack from '$lib/components/market/FlowCardBack.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import { playgroundPotentialReturnSuffix } from '$lib/derived/playground.derived';
	import type { Market } from '$lib/types/market';
	import type { MarketMetadata } from '$lib/types/market-metadata';
	import type {
		CategoryAccuracySignal,
		FollowedLeanSignal,
		PriorCallSignal
	} from '$lib/types/market-signals';
	import type { Position } from '$lib/types/position';
	import { categoryColor } from '$lib/utils/category-color.utils';
	import { FLOW_ART_CATEGORIES, type FlowArtCategory } from '$lib/utils/flow-art.utils';
	import {
		consensusPercent,
		consensusSide,
		formatFlowCallsLabel,
		formatWhyNowChip
	} from '$lib/utils/flow-card-display.utils';
	import { formatProbability, formatToken } from '$lib/utils/format.utils';

	interface Props {
		market: Market;
		onAction: (action: 'YES' | 'NO' | 'SKIP') => void;
		isLimitOrderYes: boolean;
		isLimitOrderNo: boolean;
		signedIn: boolean;
		position?: Position;
		tradeAmount: string;
		interactive?: boolean;
		// Generative-artwork category. FlowMode resolves this from the
		// SeriesCategory mappings; FlowCard treats it as opaque, falls
		// back to 'macro' if missing or unknown.
		category?: FlowArtCategory | string;
		// Optional editorial sub-line ("FOMC · rate-cut call"). When
		// undefined, FlowCard derives a short fallback from the description.
		subtitle?: string;
		// Optional accent chip (e.g. "FIRST CALL") shown on the right of
		// the header row. Sits in laurel.
		flag?: string;
		// When set, the card has already been committed to a side and is
		// playing the 80ms commit-feedback beat before the parent unmounts
		// it. Drag is locked, the matching edge tint goes to full
		// intensity, and the directional label sits at full opacity.
		committedAction?: 'YES' | 'NO' | 'SKIP' | null;
		metadata?: MarketMetadata;
		categoryAcc?: CategoryAccuracySignal;
		priorCall?: PriorCallSignal;
		followedLean?: FollowedLeanSignal;
	}

	const {
		market,
		onAction,
		isLimitOrderYes,
		isLimitOrderNo,
		signedIn,
		position,
		tradeAmount,
		interactive = true,
		category,
		subtitle,
		flag,
		committedAction = null,
		metadata,
		categoryAcc,
		priorCall,
		followedLean
	}: Props = $props();

	const isCommitted = $derived(committedAction !== null);
	const TAP_FLIP_PX = 12;
	const FLIP_MS = 180;

	let flipped = $state(false);

	const crowdSide = $derived(consensusSide(market));
	const crowdPct = $derived(consensusPercent(market));
	const callsLabel = $derived(
		formatFlowCallsLabel({ volume: market.totalVolume, decimals: market.token.decimals })
	);
	const whyNowText = $derived(formatWhyNowChip(metadata?.whyNow));
	const showPriorOnFront = $derived(Boolean(priorCall));

	const amount = $derived(parseFloat(tradeAmount) || 0);
	const potentialReturnYes = $derived(amount / (market.yesProbability || 0.1));
	const potentialReturnNo = $derived(amount / (market.noProbability || 0.1));

	const FLOW_ART_SET = new Set<string>(FLOW_ART_CATEGORIES);
	const resolvedCategory: FlowArtCategory = $derived.by(() => {
		const raw = (category ?? '').toString().toLowerCase();

		if (FLOW_ART_SET.has(raw)) {
			return raw as FlowArtCategory;
		}

		// No mapping for this market yet (admin hasn't tagged it).
		// Deterministically pick from the 6 categories using the
		// market.id so each untagged market still gets distinct
		// artwork instead of every card falling to the same default.
		let h = 0;

		for (let i = 0; i < market.id.length; i++) {
			h = (h * 31 + market.id.charCodeAt(i)) | 0;
		}

		return FLOW_ART_CATEGORIES[Math.abs(h) % FLOW_ART_CATEGORIES.length];
	});
	const catColor = $derived(categoryColor(resolvedCategory));

	let startX = 0;
	let startY = 0;
	let dragging = $state(false);

	// Swipe physics: weighted, settled, decisive. Cards should feel
	// like a tile being flipped — not flicked. `damping: 0.85` keeps
	// the spring-back from oscillating; `stiffness: 0.4` is the
	// snappy-but-not-twitchy point on Svelte's normalized curve.
	const coords = new Spring(
		{ x: 0, y: 0 },
		{
			stiffness: 0.4,
			damping: 0.85
		}
	);

	const rotation = $derived(coords.current.x / 14);
	const dragMagnitude = $derived(
		Math.min(Math.sqrt(coords.current.x ** 2 + coords.current.y ** 2) / 260, 1)
	);
	const opacity = $derived(1 - dragMagnitude * 0.18);

	const dragYesOpacity = $derived(Math.max(0, coords.current.x / 90));
	const dragNoOpacity = $derived(Math.max(0, -coords.current.x / 90));
	const dragSkipOpacity = $derived(Math.max(0, -coords.current.y / 90));

	// When the card has been committed, the matching edge label / tint
	// jump to full opacity so the 80 ms feedback beat reads as a clear
	// "I felt that" moment before the exit transition fires.
	const yesOpacity = $derived(committedAction === 'YES' ? 1 : dragYesOpacity);
	const noOpacity = $derived(committedAction === 'NO' ? 1 : dragNoOpacity);
	const skipOpacity = $derived(committedAction === 'SKIP' ? 1 : dragSkipOpacity);

	const tintYes = $derived(Math.min(yesOpacity, 1));
	const tintNo = $derived(Math.min(noOpacity, 1));
	const tintSkip = $derived(Math.min(skipOpacity, 1));

	const handleStart = (e: MouseEvent | TouchEvent) => {
		if (!interactive || isCommitted || flipped) {
			return;
		}

		dragging = true;
		startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
	};

	const handleMove = (e: MouseEvent | TouchEvent) => {
		if (!dragging || flipped) {
			return;
		}

		const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;

		coords.set({
			x: currentX - startX,
			y: currentY - startY
		});
	};

	const handleEnd = () => {
		if (!dragging) {
			return;
		}

		dragging = false;

		const threshold = 120;

		if (coords.current.x > threshold) {
			onAction('YES');
		} else if (coords.current.x < -threshold) {
			onAction('NO');
		} else if (coords.current.y < -threshold) {
			onAction('SKIP');
		} else if (
			Math.abs(coords.current.x) < TAP_FLIP_PX &&
			Math.abs(coords.current.y) < TAP_FLIP_PX
		) {
			flipped = true;
			coords.set({ x: 0, y: 0 });
		} else {
			coords.set({ x: 0, y: 0 });
		}
	};

	const closeBack = () => {
		flipped = false;
	};

	const formatExpiryEyebrow = $derived.by(() => {
		const now = Date.now();
		const exp = Number(market.expiryDate) / 1_000_000;
		const days = Math.max(0, Math.ceil((exp - now) / (1000 * 60 * 60 * 24)));

		if (days === 0) {
			return 'TODAY';
		}

		if (days >= 365) {
			return `${Math.round(days / 365)}y`;
		}

		return `${days}d`;
	});

	// First clause of description (up to ~52 chars) — only used when no
	// explicit `subtitle` is passed by the parent.
	const fallbackSubtitle = $derived.by(() => {
		const desc = market.description ?? '';
		const head = desc.split(/[.!?]\s/)[0]?.trim() ?? '';

		if (head.length <= 52) {
			return head;
		}

		return `${head.slice(0, 49).trimEnd()}…`;
	});

	const subtitleText = $derived(subtitle ?? fallbackSubtitle);

	const yesPctLabel = $derived(formatProbability(market.yesProbability));
	const noPctLabel = $derived(formatProbability(market.noProbability));

	$effect(() => {
		market.id;
		flipped = false;
	});
</script>

<div
	class="flow-card-root"
	onmouseleave={handleEnd}
	onmousemove={handleMove}
	onmouseup={handleEnd}
	ontouchend={handleEnd}
	ontouchmove={handleMove}
	role="presentation"
>
	<div
		style:transform="translate3d({coords.current.x}px, {coords.current.y}px, 0) rotate({rotation}deg)"
		style:opacity
		class="flow-card"
		class:is-committed={isCommitted}
		class:is-flipped={flipped}
		class:is-grabbing={dragging}
		class:is-static={!interactive}
		onmousedown={handleStart}
		ontouchstart={handleStart}
		role="presentation"
	>
		<!-- Edge-tint layers — subtle ring inside the card during drag.
		     Routine swipes get edge tint + XP pop + haptic, no character. -->
		<div
			style:opacity={tintYes}
			style:box-shadow="inset 0 0 0 2px rgba(79, 211, 161, {tintYes}), inset 0 0 60px rgba(79, 211,
			161, {tintYes * 0.35})"
			class="flow-card-tint"
		></div>
		<div
			style:opacity={tintNo}
			style:box-shadow="inset 0 0 0 2px rgba(255, 107, 107, {tintNo}), inset 0 0 60px rgba(255, 107,
			107, {tintNo * 0.35})"
			class="flow-card-tint"
		></div>
		<div
			style:opacity={tintSkip}
			style:box-shadow="inset 0 0 0 2px color-mix(in srgb, var(--text-base) {tintSkip * 40}%,
			transparent), inset 0 0 60px color-mix(in srgb, var(--text-base) {tintSkip * 18}%,
			transparent)"
			class="flow-card-tint"
		></div>

		<!-- Drag-direction labels (replace the old giant YES/NO/SKIP stamps).
		     Tiny laurel/yes/no signals that appear on edge approach. -->
		<div
			style:opacity={signedIn ? yesOpacity : yesOpacity * 0.5}
			style:transform="scale({0.92 + yesOpacity * 0.08})"
			class="flow-edge-label flow-edge-yes"
		>
			<span class="flow-edge-arrow">→</span>
			<span class="flow-edge-text">YES</span>
			<span class="flow-edge-meta num">
				+{potentialReturnYes.toFixed(2)}{$playgroundPotentialReturnSuffix}
			</span>
			{#if isLimitOrderYes}
				<span class="flow-edge-pill">Limit</span>
			{/if}
		</div>
		<div
			style:opacity={signedIn ? noOpacity : noOpacity * 0.5}
			style:transform="scale({0.92 + noOpacity * 0.08})"
			class="flow-edge-label flow-edge-no"
		>
			<span class="flow-edge-arrow">←</span>
			<span class="flow-edge-text">NO</span>
			<span class="flow-edge-meta num">
				+{potentialReturnNo.toFixed(2)}{$playgroundPotentialReturnSuffix}
			</span>
			{#if isLimitOrderNo}
				<span class="flow-edge-pill">Limit</span>
			{/if}
		</div>
		<div
			style:opacity={skipOpacity}
			style:transform="translate(-50%, 0) scale({0.92 + skipOpacity * 0.08})"
			class="flow-edge-label flow-edge-skip"
		>
			<span class="flow-edge-arrow">↑</span>
			<span class="flow-edge-text">SKIP</span>
		</div>

		<div
			style:opacity={flipped ? 0 : 1}
			style:pointer-events={flipped ? 'none' : 'auto'}
			style:transition="opacity {FLIP_MS}ms var(--ease-vici) {flipped ? '0ms' : `${FLIP_MS}ms`}"
			class="flow-face flow-face-front"
		>
			<div style:--cat-color={catColor} class="flow-card-body">
				<header class="flow-card-head">
					<div class="flow-meta-row">
						<span class="allcaps flow-cat">{resolvedCategory}</span>
						<span class="flow-meta-sep" aria-hidden="true">·</span>
						<span class="num flow-meta-time">{formatExpiryEyebrow}</span>
						{#if position}
							<span class="flow-meta-sep" aria-hidden="true">·</span>
							<span class="allcaps flow-meta-position num">
								Holding {formatToken({ value: position.netQty, unitName: market.token.decimals })}
								{market.token.symbol}
							</span>
						{/if}
						{#if flag}
							<span class="allcaps flow-flag">{flag}</span>
						{/if}
					</div>

					{#if showPriorOnFront && priorCall}
						<p class="flow-whynow flow-whynow-prior">
							You called <strong>{priorCall.side}</strong> · {priorCall.when}
						</p>
					{:else if whyNowText}
						<p class="flow-whynow">{whyNowText}</p>
					{/if}

					<h2 class="flow-card-title">{market.title}</h2>
					{#if subtitleText}
						<p class="flow-card-sub">{subtitleText}</p>
					{/if}
				</header>

				<div class="flow-art-slot">
					<FlowArtFrame
						class="flow-art"
						category={resolvedCategory}
						seed={market.id}
						size={260}
						state="neutral"
					/>
				</div>

				<p class="flow-sharp">
					<span class="flow-sharp-dot" aria-hidden="true"></span>
					<span>
						Sharp predictors:
						<span
							class="num"
							class:text-no={crowdSide === 'NO'}
							class:text-yes={crowdSide === 'YES'}
						>
							{crowdPct}%
						</span>
						<span class:text-no={crowdSide === 'NO'} class:text-yes={crowdSide === 'YES'}>
							{crowdSide}
						</span>
					</span>
				</p>

				<div class="flow-prob">
					<BaseButton
						class="flow-prob-side flow-prob-no{crowdSide === 'NO' ? ' is-consensus' : ''}"
						onclick={() => onAction('NO')}
					>
						<span class="flow-prob-top">
							<span class="flow-prob-chevron text-no" aria-hidden="true">←</span>
							<span class="allcaps flow-prob-label text-no">NO</span>
						</span>
						<span class="num flow-prob-pct text-no">{noPctLabel}</span>
						{#if isLimitOrderNo}
							<span class="flow-prob-badge bg-no-wash text-no">Limit</span>
						{/if}
					</BaseButton>
					<BaseButton
						class="flow-prob-side flow-prob-yes{crowdSide === 'YES' ? ' is-consensus' : ''}"
						onclick={() => onAction('YES')}
					>
						<span class="flow-prob-top">
							<span class="allcaps flow-prob-label text-yes">YES</span>
							<span class="flow-prob-chevron text-yes" aria-hidden="true">→</span>
						</span>
						<span class="num flow-prob-pct text-yes">{yesPctLabel}</span>
						{#if isLimitOrderYes}
							<span class="flow-prob-badge bg-yes-wash text-yes">Limit</span>
						{/if}
					</BaseButton>
				</div>

				<div class="flow-card-foot num">
					<span>{callsLabel}</span>
					<span class="allcaps">Tap for depth</span>
				</div>

				<div class="flow-card-rail">
					<span class="flow-rail-side"><span class="flow-rail-arrow">←</span> NO</span>
					<span class="flow-rail-mid allcaps">Drag to commit · Tap for depth</span>
					<span class="flow-rail-side">YES <span class="flow-rail-arrow">→</span></span>
				</div>
			</div>
		</div>

		<div
			style:opacity={flipped ? 1 : 0}
			style:pointer-events={flipped ? 'auto' : 'none'}
			style:transition="opacity {FLIP_MS}ms var(--ease-vici) {flipped ? `${FLIP_MS}ms` : '0ms'}"
			class="flow-face flow-face-back"
		>
			{#if flipped}
				<FlowCardBack
					category={resolvedCategory}
					{categoryAcc}
					{followedLean}
					{market}
					{metadata}
					onClose={closeBack}
					{priorCall}
				/>
			{/if}
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
		perspective: 1000px;
	}

	.flow-card {
		position: relative;
		width: 100%;
		height: 100%;
		cursor: grab;
		user-select: none;
		touch-action: pan-y;
		will-change: transform, opacity;
	}
	.flow-card.is-flipped {
		cursor: default;
	}

	.flow-face {
		position: absolute;
		inset: 0;
	}

	.flow-face-front {
		z-index: 2;
	}

	.flow-face-back {
		z-index: 3;
	}
	.flow-card.is-grabbing {
		cursor: grabbing;
	}
	.flow-card.is-static {
		cursor: default;
	}
	/* Brief 80 ms commit-feedback beat — drag is locked from
	   `handleStart`; the visual lock here is the cursor / pointer
	   change so the user sees the card stop responding to motion. */
	.flow-card.is-committed {
		cursor: default;
		pointer-events: none;
	}

	.flow-card-tint {
		position: absolute;
		inset: 0;
		z-index: 10;
		pointer-events: none;
		border-radius: var(--r-12);
		transition: opacity var(--d-state) var(--ease-vici);
	}

	.flow-card-body {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		overflow: hidden;
		height: 100%;
		width: 100%;
		padding: 0;
		background:
			radial-gradient(
				circle at 18% 0%,
				color-mix(in srgb, var(--cat-color) 18%, transparent),
				transparent 32%
			),
			linear-gradient(180deg, var(--bg-popover), var(--bg-surface));
		border: 1px solid var(--border-strong);
		border-radius: var(--r-12);
		box-shadow:
			var(--inset-hi),
			0 12px 24px rgba(0, 0, 0, 0.3),
			0 32px 60px rgba(0, 0, 0, 0.2);
	}
	@media (min-width: 768px) {
		.flow-card-body {
			gap: 1rem;
		}
	}

	.flow-card-head {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 1.1rem 1.1rem 1rem;
		border-bottom: 1px solid color-mix(in srgb, var(--cat-color) 18%, transparent);
		background: linear-gradient(
			160deg,
			color-mix(in srgb, var(--cat-color) 14%, transparent),
			transparent 68%
		);
	}
	@media (min-width: 768px) {
		.flow-card-head {
			padding: 1.25rem 1.25rem 1rem;
		}
	}

	.flow-meta-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		font-size: var(--t-12);
		color: var(--text-muted);
	}
	.flow-cat {
		color: var(--cat-color);
		font-size: var(--t-12);
	}
	.flow-meta-sep {
		color: var(--text-muted);
		opacity: 0.6;
	}
	.flow-meta-time {
		font-size: var(--t-12);
		color: var(--text-muted);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: var(--tracking-allcaps);
	}
	.flow-meta-position {
		color: var(--laurel);
	}
	.flow-flag {
		margin-left: auto;
		color: var(--laurel);
		font-size: var(--t-12);
	}

	.flow-card-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.35rem, 5.8vw, 1.75rem);
		line-height: var(--leading-snug);
		font-weight: 600;
		letter-spacing: var(--tracking-snug);
		color: var(--text-base);
		overflow-wrap: anywhere;
	}
	@media (min-width: 400px) {
		.flow-card-title {
			font-size: 1.85rem;
		}
	}
	@media (min-width: 768px) {
		.flow-card-title {
			font-size: 2rem;
		}
	}

	.flow-card-sub {
		margin: 0;
		font-size: var(--t-13);
		line-height: var(--leading-normal);
		color: var(--text-muted);
		font-family: var(--font-display);
	}

	.flow-whynow {
		align-self: flex-start;
		margin: 0;
		padding: 0.32rem 0.55rem;
		border-radius: var(--r-pill);
		border: 1px solid color-mix(in srgb, var(--cat-color) 24%, var(--border-base));
		background: color-mix(in srgb, var(--cat-color) 10%, var(--bg-surface));
		font-size: var(--t-12);
		color: var(--laurel);
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.flow-whynow-prior strong {
		font-weight: 700;
	}

	.flow-sharp {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 1.1rem;
		padding: 0.5rem 0.65rem;
		border-radius: var(--r-8);
		border: 1px solid color-mix(in srgb, var(--cat-color) 18%, var(--border-base));
		background:
			linear-gradient(90deg, color-mix(in srgb, var(--cat-color) 10%, transparent), transparent),
			var(--bg-surface);
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.flow-sharp-dot {
		width: 6px;
		height: 6px;
		border-radius: var(--r-pill);
		background: var(--cat-color);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--cat-color) 12%, transparent);
		flex-shrink: 0;
	}

	.flow-card-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 0 1.1rem;
		font-size: var(--t-12);
		color: var(--text-muted);
		letter-spacing: 0.06em;
	}

	.flow-art-slot {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1 1 auto;
		min-height: 0;
		padding: 0.15rem 1rem 0;
	}

	.flow-art-slot :global(.flow-art) {
		max-width: 100%;
		height: auto;
		max-height: 100%;
		aspect-ratio: 1 / 1;
	}

	.flow-prob {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.625rem;
		margin: 0 1.1rem;
	}

	:global(.flow-prob-side) {
		position: relative;
		display: flex !important;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		min-height: 5.4rem;
		padding: 0.75rem 0.65rem;
		border-radius: var(--r-12);
		border-width: 1px;
		border-style: solid;
		background: var(--bg-surface);
		transition:
			transform var(--d-hover) var(--ease-vici),
			background-color var(--d-state) var(--ease-vici);
	}
	:global(.flow-prob-side:active) {
		transform: scale(0.985);
	}
	:global(.flow-prob-no) {
		border-color: rgba(255, 107, 107, 0.18);
	}
	:global(.flow-prob-no:hover) {
		background: var(--no-wash);
	}
	:global(.flow-prob-yes) {
		border-color: rgba(79, 211, 161, 0.18);
	}
	:global(.flow-prob-yes:hover) {
		background: var(--yes-wash);
	}
	:global(.flow-prob-side.is-consensus.flow-prob-no) {
		border-color: rgba(255, 107, 107, 0.45);
		box-shadow: inset 0 0 0 1px rgba(255, 107, 107, 0.2);
	}
	:global(.flow-prob-side.is-consensus.flow-prob-yes) {
		border-color: rgba(79, 211, 161, 0.45);
		box-shadow: inset 0 0 0 1px rgba(79, 211, 161, 0.2);
	}
	:global(.flow-prob-label) {
		display: block;
		font-size: var(--t-12);
		font-weight: 600;
	}
	:global(.flow-prob-top) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
	}
	:global(.flow-prob-chevron) {
		font-size: var(--t-16);
		font-weight: 700;
		line-height: 1;
	}
	:global(.flow-prob-pct) {
		display: block;
		font-size: 1.8rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1;
	}
	:global(.flow-prob-badge) {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		padding: 2px 6px;
		border-radius: var(--r-pill);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.flow-card-rail {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin: 0 1.1rem 1rem;
		padding-top: 0.65rem;
		border-top: 1px solid var(--border-base);
		font-size: var(--t-12);
		color: var(--text-muted);
		font-family: var(--font-display);
		font-weight: 500;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}
	.flow-rail-side {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--text-muted);
	}
	.flow-rail-arrow {
		color: var(--laurel);
		font-weight: 700;
	}
	.flow-rail-mid {
		flex: 1 1 auto;
		text-align: center;
		font-size: 10px;
		color: var(--text-muted);
		opacity: 0.56;
	}
	@media (max-width: 360px) {
		.flow-rail-mid {
			display: none;
		}
	}

	.flow-edge-label {
		position: absolute;
		z-index: 20;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 0.5rem 1rem;
		background: var(--bg-popover);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-8);
		pointer-events: none;
		font-family: var(--font-display);
		text-transform: uppercase;
		letter-spacing: var(--tracking-allcaps);
	}
	.flow-edge-arrow {
		font-size: var(--t-20);
		font-weight: 700;
		line-height: 1;
	}
	.flow-edge-text {
		font-size: var(--t-12);
		font-weight: 700;
	}
	.flow-edge-meta {
		font-size: 10px;
		color: var(--text-muted);
	}
	.flow-edge-pill {
		margin-top: 0.25rem;
		padding: 1px 6px;
		border-radius: var(--r-pill);
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-base);
		background: var(--bg-surface);
	}
	.flow-edge-yes {
		top: 1.25rem;
		right: 1rem;
		border-color: var(--yes);
		color: var(--yes);
	}
	.flow-edge-no {
		top: 1.25rem;
		left: 1rem;
		border-color: var(--no);
		color: var(--no);
	}
	.flow-edge-skip {
		bottom: 30%;
		left: 50%;
		border-color: var(--border-strong);
		color: var(--text-muted);
	}
</style>
