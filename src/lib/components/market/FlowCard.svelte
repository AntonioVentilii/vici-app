<script lang="ts">
	import { Spring } from 'svelte/motion';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import { playgroundPotentialReturnSuffix } from '$lib/derived/playground.derived';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
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
	}

	const {
		market,
		onAction,
		isLimitOrderYes,
		isLimitOrderNo,
		signedIn,
		position,
		tradeAmount,
		interactive = true
	}: Props = $props();

	const amount = $derived(parseFloat(tradeAmount) || 0);
	const potentialReturnYes = $derived(amount / (market.yesProbability || 0.1));
	const potentialReturnNo = $derived(amount / (market.noProbability || 0.1));

	let startX = 0;
	let startY = 0;
	let dragging = $state(false);

	const coords = new Spring(
		{ x: 0, y: 0 },
		{
			stiffness: 0.15,
			damping: 0.5
		}
	);

	const rotation = $derived(coords.current.x / 14);
	const dragMagnitude = $derived(
		Math.min(Math.sqrt(coords.current.x ** 2 + coords.current.y ** 2) / 260, 1)
	);
	const opacity = $derived(1 - dragMagnitude * 0.25);

	// Action indicators (0 - 1)
	const yesOpacity = $derived(Math.max(0, coords.current.x / 90));
	const noOpacity = $derived(Math.max(0, -coords.current.x / 90));
	const skipOpacity = $derived(Math.max(0, -coords.current.y / 90));

	// Tint glow based on drag
	const tintYes = $derived(Math.min(yesOpacity, 1));
	const tintNo = $derived(Math.min(noOpacity, 1));
	const tintSkip = $derived(Math.min(skipOpacity, 1));

	const handleStart = (e: MouseEvent | TouchEvent) => {
		if (!interactive) {
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

	const formatDate = (expiry: bigint) => {
		const date = new Date(Number(expiry) / 1_000_000);

		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	};

	const daysUntilExpiry = $derived.by(() => {
		const now = Date.now();
		const exp = Number(market.expiryDate) / 1_000_000;
		const days = Math.max(0, Math.ceil((exp - now) / (1000 * 60 * 60 * 24)));

		return days;
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
		style="transform: translate3d({coords.current.x}px, {coords.current
			.y}px, 0) rotate({rotation}deg); opacity: {opacity};"
		class="flow-card"
		class:is-grabbing={dragging}
		class:is-static={!interactive}
		onmousedown={handleStart}
		ontouchstart={handleStart}
		role="presentation"
	>
		<!-- Swipe tint glow -->
		<div
			style="box-shadow: inset 0 0 0 4px rgba(79, 211, 161, {tintYes}), inset 0 0 60px rgba(79, 211, 161, {tintYes *
				0.4}); opacity: {tintYes}"
			class="pointer-events-none absolute inset-0 z-10 rounded-4xl transition-opacity md:rounded-[40px]"
		></div>
		<div
			style="box-shadow: inset 0 0 0 4px rgba(255, 107, 107, {tintNo}), inset 0 0 60px rgba(255, 107, 107, {tintNo *
				0.4}); opacity: {tintNo}"
			class="pointer-events-none absolute inset-0 z-10 rounded-4xl transition-opacity md:rounded-[40px]"
		></div>
		<div
			style="box-shadow: inset 0 0 0 4px var(--parchment-faint, rgba(148, 163, 184, {tintSkip})), inset 0 0 60px rgba(242, 236, 220, {tintSkip *
				0.2}); opacity: {tintSkip}"
			class="pointer-events-none absolute inset-0 z-10 rounded-4xl transition-opacity md:rounded-[40px]"
		></div>

		<!-- YES Indicator (stamp) -->
		<div
			style="opacity: {signedIn
				? yesOpacity
				: yesOpacity * 0.5}; transform: rotate(-12deg) scale({0.85 + yesOpacity * 0.15})"
			class="stamp stamp-yes"
		>
			<span class="text-5xl font-black tracking-tighter text-[var(--yes)]">YES</span>
			<div class="mt-1 flex flex-col items-center">
				<span class="font-mono text-lg font-black text-[var(--yes-deep)] tabular-nums">
					+{potentialReturnYes.toFixed(2)}{$playgroundPotentialReturnSuffix}
				</span>
				<span class="text-[9px] font-bold tracking-widest text-[var(--yes)] uppercase">
					Potential
				</span>
			</div>
			{#if isLimitOrderYes}
				<span class="stamp-pill bg-[var(--yes)]">Limit Order</span>
			{/if}
		</div>

		<!-- NO Indicator (stamp) -->
		<div
			style="opacity: {signedIn
				? noOpacity
				: noOpacity * 0.5}; transform: rotate(12deg) scale({0.85 + noOpacity * 0.15})"
			class="stamp stamp-no"
		>
			<span class="text-5xl font-black tracking-tighter text-[var(--no)]">NO</span>
			<div class="mt-1 flex flex-col items-center">
				<span class="font-mono text-lg font-black text-[var(--no-deep)] tabular-nums">
					+{potentialReturnNo.toFixed(2)}{$playgroundPotentialReturnSuffix}
				</span>
				<span class="text-[9px] font-bold tracking-widest text-[var(--no)] uppercase">
					Potential
				</span>
			</div>
			{#if isLimitOrderNo}
				<span class="stamp-pill bg-[var(--no)]">Limit Order</span>
			{/if}
		</div>

		<!-- SKIP Indicator (stamp) -->
		<div
			style="opacity: {skipOpacity}; transform: translate(-50%, 0) scale({0.85 +
				skipOpacity * 0.15})"
			class="stamp stamp-skip"
		>
			<span class="text-muted-foreground text-4xl font-black tracking-tighter">SKIP</span>
		</div>

		<div class="flow-card-body">
			<!-- Header -->
			<div class="flow-card-header">
				<div class="absolute inset-0 opacity-30">
					<div
						class="absolute -top-32 -left-20 h-72 w-72 rounded-full bg-[var(--laurel)]/20 blur-3xl"
					></div>
					<div
						class="absolute -right-20 -bottom-24 h-72 w-72 rounded-full bg-[var(--laurel)]/10 blur-3xl"
					></div>
				</div>

				<!-- Top chips -->
				<div class="relative z-10 flex items-start justify-between gap-2">
					<div
						class="bg-foreground/15 flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ring-white/20 backdrop-blur-sm"
					>
						<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2.5"
							/>
						</svg>
						<span class="text-[10px] font-black tracking-wider text-white uppercase tabular-nums">
							{#if daysUntilExpiry === 0}
								Ends today
							{:else if daysUntilExpiry === 1}
								1 day
							{:else}
								{daysUntilExpiry} days
							{/if}
						</span>
					</div>

					{#if position}
						<div
							class="bg-foreground/15 flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ring-white/20 backdrop-blur-sm"
						>
							<div class="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300"></div>
							<span class="text-[10px] font-black tracking-wider text-white uppercase">
								Holding {formatToken({ value: position.netQty, unitName: market.token.decimals })}
								{market.token.symbol}
							</span>
						</div>
					{/if}
				</div>

				<!-- Title -->
				<h2 class="flow-card-title">{market.title}</h2>
			</div>

			<!-- Content -->
			<div class="flow-card-content">
				<p class="flow-card-desc">{market.description}</p>

				<div class="flow-card-tiles">
					<BaseButton class="flow-tile flow-tile-no" onclick={() => onAction('NO')}>
						<span class="flow-tile-label text-[var(--no)]">NO</span>
						<span class="flow-tile-pct text-[var(--no)]">
							{formatProbability(market.noProbability)}
						</span>
						<span class="flow-tile-hint text-[var(--no)]/60"> ← Swipe </span>
						{#if isLimitOrderNo}
							<div class="flow-tile-badge bg-[var(--no-wash)] text-[var(--no)]">Limit</div>
						{/if}
					</BaseButton>

					<BaseButton class="flow-tile flow-tile-yes" onclick={() => onAction('YES')}>
						<span class="flow-tile-label text-[var(--yes)]">YES</span>
						<span class="flow-tile-pct text-[var(--yes)]">
							{formatProbability(market.yesProbability)}
						</span>
						<span class="flow-tile-hint text-[var(--yes)]/60"> Swipe → </span>
						{#if isLimitOrderYes}
							<div class="flow-tile-badge bg-[var(--yes-wash)] text-[var(--yes)]">Limit</div>
						{/if}
					</BaseButton>
				</div>

				<!-- Footer -->
				<div class="flow-card-footer">
					<div class="flex items-center gap-1.5">
						<svg
							class="text-muted-foreground h-3 w-3"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
							/>
						</svg>
						<span class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
							Expires {formatDate(market.expiryDate)}
						</span>
					</div>

					{#if !signedIn}
						<div class="flex items-center gap-1.5">
							<svg
								class="text-muted-foreground h-3 w-3"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
								/>
							</svg>
							<span class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
								Sign in to play
							</span>
						</div>
					{/if}
				</div>
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

	.flow-card-body {
		position: relative;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		height: 100%;
		width: 100%;
		background: var(--bg-popover);
		border: 1px solid var(--border-strong);
		border-radius: 12px;
		box-shadow:
			var(--inset-hi),
			0 12px 24px rgba(0, 0, 0, 0.3),
			0 32px 60px rgba(0, 0, 0, 0.2);
	}
	@media (min-width: 768px) {
		.flow-card-body {
			border-radius: 16px;
		}
	}

	.flow-card-header {
		position: relative;
		flex: 0 0 auto;
		padding: 1.25rem 1.5rem 1.5rem;
		background: linear-gradient(135deg, var(--ink-deep) 0%, var(--ink-raised) 100%);
		color: var(--parchment);
		overflow: hidden;
	}
	@media (min-width: 768px) {
		.flow-card-header {
			padding: 1.75rem 2rem 2rem;
		}
	}

	.flow-card-title {
		position: relative;
		z-index: 1;
		margin-top: 0.875rem;
		font-family: var(--font-display);
		font-size: 1.25rem;
		line-height: 1.2;
		font-weight: 600;
		letter-spacing: -0.015em;
		color: var(--parchment);
		overflow-wrap: anywhere;
	}
	@media (min-width: 400px) {
		.flow-card-title {
			font-size: 1.5rem;
		}
	}
	@media (min-width: 768px) {
		.flow-card-title {
			font-size: 1.75rem;
			margin-top: 1rem;
		}
	}

	.flow-card-content {
		flex: 1 1 auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem 1.5rem 1.5rem;
		min-height: 0;
	}
	@media (min-width: 768px) {
		.flow-card-content {
			padding: 1.75rem 2rem 2rem;
			gap: 1.25rem;
		}
	}

	.flow-card-desc {
		flex: 1 1 auto;
		font-size: 0.875rem;
		line-height: 1.55;
		color: var(--text-muted);
		overflow: hidden;
		overflow-wrap: anywhere;
		display: -webkit-box;
		-webkit-line-clamp: 4;
		-webkit-box-orient: vertical;
	}
	@media (min-width: 768px) {
		.flow-card-desc {
			font-size: 0.9375rem;
			-webkit-line-clamp: 6;
		}
	}

	.flow-card-tiles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.625rem;
	}

	:global(.flow-tile) {
		position: relative;
		display: flex !important;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		padding: 0.875rem 0.5rem;
		border-radius: 24px;
		border-width: 1px;
		border-style: solid;
		transition:
			transform 0.15s ease,
			background-color 0.2s ease;
	}
	:global(.flow-tile:active) {
		transform: scale(0.985);
	}
	:global(.flow-tile-no) {
		background: var(--bg-surface);
		border-color: rgba(255, 107, 107, 0.2);
	}
	:global(.flow-tile-no:hover) {
		background: var(--no-wash);
	}
	:global(.flow-tile-yes) {
		background: var(--bg-surface);
		border-color: rgba(79, 211, 161, 0.2);
	}
	:global(.flow-tile-yes:hover) {
		background: var(--yes-wash);
	}

	:global(.flow-tile-label) {
		display: block;
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
	:global(.flow-tile-pct) {
		display: block;
		font-family: var(--font-mono);
		font-size: 1.875rem;
		font-weight: 900;
		letter-spacing: -0.025em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	:global(.flow-tile-hint) {
		display: block;
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		margin-top: 2px;
	}
	:global(.flow-tile-badge) {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 8px;
		font-weight: 900;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.flow-card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding-top: 0.625rem;
		border-top: 1px solid var(--border-base);
		flex-wrap: wrap;
	}

	/* Swipe stamps */
	.stamp {
		position: absolute;
		z-index: 20;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.75rem 1.75rem;
		background: rgba(14, 13, 11, 0.92);
		border-radius: 18px;
		border-width: 4px;
		border-style: solid;
		pointer-events: none;
	}
	.stamp-yes {
		top: 2.5rem;
		left: 1.5rem;
		border-color: var(--yes);
		box-shadow: 0 20px 50px rgba(79, 211, 161, 0.3);
	}
	.stamp-no {
		top: 2.5rem;
		right: 1.5rem;
		border-color: var(--no);
		box-shadow: 0 20px 50px rgba(255, 107, 107, 0.3);
	}
	.stamp-skip {
		bottom: 30%;
		left: 50%;
		border-color: var(--border-strong);
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
	}
	.stamp-pill {
		margin-top: 0.5rem;
		padding: 3px 10px;
		border-radius: 999px;
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: white;
	}
</style>
