<script lang="ts">
	import { Spring } from 'svelte/motion';
	import FlowArtFrame from '$lib/components/artwork/FlowArtFrame.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import { playgroundPotentialReturnSuffix } from '$lib/derived/playground.derived';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
	import { categoryColor } from '$lib/utils/category-color.utils';
	import { FLOW_ART_CATEGORIES, type FlowArtCategory } from '$lib/utils/flow-art.utils';
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
		committedAction = null
	}: Props = $props();

	const isCommitted = $derived(committedAction !== null);

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

	// Brand README §05 ("Animation"): "Swipe physics (Flow Mode) are
	// heavier than Tinder — damping: 0.85, stiffness: 220. Cards feel
	// weighted, like flipping a tile, not flicking a Polaroid."
	//
	// The spec value `stiffness: 220` is iOS / SwiftUI native units;
	// Svelte's `Spring` exposes a normalized 0..1 stiffness. The
	// translation here keeps the same "snappy + settled" character —
	// `damping: 0.85` maps directly (Svelte's damping is the same
	// damping-ratio concept), and `stiffness: 0.4` is the closest
	// settled-but-responsive point on Svelte's curve. Tuned by feel
	// against the spec's "tile flip, not Polaroid flick" intent.
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
		if (!interactive || isCommitted) {
			return;
		}

		dragging = true;
		startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
	};

	const handleMove = (e: MouseEvent | TouchEvent) => {
		if (!dragging) {
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
		} else {
			coords.set({ x: 0, y: 0 });
		}
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
			style:box-shadow="inset 0 0 0 2px rgba(242, 236, 220, {tintSkip * 0.4}), inset 0 0 60px
			rgba(242, 236, 220, {tintSkip * 0.18})"
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

		<div class="flow-card-body">
			<header class="flow-card-head">
				<div class="flow-meta-row">
					<span style:color={catColor} class="allcaps flow-cat">{resolvedCategory}</span>
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

			<div class="flow-prob">
				<BaseButton class="flow-prob-side flow-prob-no" onclick={() => onAction('NO')}>
					<span class="allcaps flow-prob-label text-no">NO</span>
					<span class="num flow-prob-pct text-no">{noPctLabel}</span>
					{#if isLimitOrderNo}
						<span class="flow-prob-badge bg-no-wash text-no">Limit</span>
					{/if}
				</BaseButton>
				<BaseButton class="flow-prob-side flow-prob-yes" onclick={() => onAction('YES')}>
					<span class="allcaps flow-prob-label text-yes">YES</span>
					<span class="num flow-prob-pct text-yes">{yesPctLabel}</span>
					{#if isLimitOrderYes}
						<span class="flow-prob-badge bg-yes-wash text-yes">Limit</span>
					{/if}
				</BaseButton>
			</div>

			<div class="flow-card-rail">
				<span class="flow-rail-side"><span class="flow-rail-arrow">←</span> NO</span>
				<span class="flow-rail-mid allcaps">DRAG TO COMMIT · TAP FOR DETAIL</span>
				<span class="flow-rail-side">YES <span class="flow-rail-arrow">→</span></span>
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
		gap: 1rem;
		overflow: hidden;
		height: 100%;
		width: 100%;
		padding: 1.25rem 1.25rem 1rem;
		background: var(--bg-popover);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-12);
		box-shadow:
			var(--inset-hi),
			0 12px 24px rgba(0, 0, 0, 0.3),
			0 32px 60px rgba(0, 0, 0, 0.2);
	}
	@media (min-width: 768px) {
		.flow-card-body {
			padding: 1.5rem 1.5rem 1.25rem;
			gap: 1.25rem;
		}
	}

	.flow-card-head {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
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
		color: var(--cat-macro); /* overridden inline by `style:color={catColor}` */
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
		font-size: 1.5rem;
		line-height: var(--leading-snug);
		font-weight: 600;
		letter-spacing: var(--tracking-snug);
		color: var(--parchment);
		overflow-wrap: anywhere;
	}
	@media (min-width: 400px) {
		.flow-card-title {
			font-size: 1.75rem;
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

	.flow-art-slot {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1 1 auto;
		min-height: 0;
		padding: 0.25rem 0;
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
	}

	:global(.flow-prob-side) {
		position: relative;
		display: flex !important;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		padding: 0.625rem 0.5rem;
		border-radius: var(--r-8);
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
	:global(.flow-prob-label) {
		display: block;
		font-size: var(--t-12);
		font-weight: 600;
	}
	:global(.flow-prob-pct) {
		display: block;
		font-size: 1.5rem;
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
		padding-top: 0.5rem;
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
		color: var(--parchment-mute);
	}
	.flow-rail-arrow {
		color: var(--laurel);
		font-weight: 700;
	}
	.flow-rail-mid {
		flex: 1 1 auto;
		text-align: center;
		font-size: 10px;
		color: var(--parchment-faint);
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
		background: rgba(14, 13, 11, 0.92);
		border: 1px solid var(--ink-line-strong);
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
		color: var(--parchment-mute);
	}
	.flow-edge-pill {
		margin-top: 0.25rem;
		padding: 1px 6px;
		border-radius: var(--r-pill);
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--parchment);
		background: var(--ink-elevated);
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
		color: var(--parchment-mute);
	}
</style>
