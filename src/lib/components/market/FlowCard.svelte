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
	}

	const {
		market,
		onAction,
		isLimitOrderYes,
		isLimitOrderNo,
		signedIn,
		position,
		tradeAmount
	}: Props = $props();

	const amount = $derived(parseFloat(tradeAmount) || 0);
	const potentialReturnYes = $derived(amount / (market.yesProbability || 0.1));
	const potentialReturnNo = $derived(amount / (market.noProbability || 0.1));

	let startX = 0;
	let startY = 0;
	let dragging = false;

	const coords = new Spring(
		{ x: 0, y: 0 },
		{
			stiffness: 0.15,
			damping: 0.5
		}
	);

	const rotation = $derived(coords.current.x / 12);
	const opacity = $derived(
		1 - Math.min(Math.abs(coords.current.x) / 500 + Math.abs(coords.current.y) / 500, 0.4)
	);

	// Action indicators
	const yesOpacity = $derived(Math.max(0, coords.current.x / 80));
	const noOpacity = $derived(Math.max(0, -coords.current.x / 80));
	const skipOpacity = $derived(Math.max(0, -coords.current.y / 80));

	const handleStart = (e: MouseEvent | TouchEvent) => {
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
</script>

<div
	class="perspective-1000 relative flex h-full w-full items-center justify-center p-0 md:p-4"
	onmouseleave={handleEnd}
	onmousemove={handleMove}
	onmouseup={handleEnd}
	ontouchend={handleEnd}
	ontouchmove={handleMove}
	role="presentation"
>
	<div
		style="transform: translate3d({coords.current.x}px, {coords.current
			.y}px, 0) rotate({rotation}deg); opacity: {opacity}"
		class="relative h-[85vh] w-full max-w-95 cursor-grab select-none active:cursor-grabbing md:h-150"
		onmousedown={handleStart}
		ontouchstart={handleStart}
		role="presentation"
	>
		<!-- YES Indicator -->
		<div
			style="opacity: {signedIn ? yesOpacity : yesOpacity * 0.5}; transform: rotate(-12deg)"
			class="absolute top-16 left-8 z-20 flex flex-col items-center rounded-2xl border-4 border-emerald-500 bg-white/95 px-8 py-4 shadow-[0_20px_50px_rgba(16,185,129,0.3)]"
		>
			<span class="text-5xl font-black tracking-tighter text-emerald-500">YES</span>
			<div class="mt-2 flex flex-col items-center">
				<span class="text-xl font-black text-emerald-600">
					+{potentialReturnYes.toFixed(2)}{$playgroundPotentialReturnSuffix}
				</span>
				<span class="text-[10px] font-bold tracking-widest text-emerald-500 uppercase">
					Potential
				</span>
			</div>
			{#if isLimitOrderYes}
				<span
					class="mt-3 rounded-full bg-emerald-500 px-3 py-1 text-xs tracking-widest text-white uppercase"
				>
					Limit Order
				</span>
			{/if}
		</div>

		<!-- NO Indicator -->
		<div
			style="opacity: {signedIn ? noOpacity : noOpacity * 0.5}; transform: rotate(12deg)"
			class="absolute top-16 right-8 z-20 flex flex-col items-center rounded-2xl border-4 border-rose-500 bg-white/95 px-8 py-4 shadow-[0_20px_50px_rgba(244,63,94,0.3)]"
		>
			<span class="text-5xl font-black tracking-tighter text-rose-500">NO</span>
			<div class="mt-2 flex flex-col items-center">
				<span class="text-xl font-black text-rose-600">
					+{potentialReturnNo.toFixed(2)}{$playgroundPotentialReturnSuffix}
				</span>
				<span class="text-[10px] font-bold tracking-widest text-rose-500 uppercase">
					Potential
				</span>
			</div>
			{#if isLimitOrderNo}
				<span
					class="mt-3 rounded-full bg-rose-500 px-3 py-1 text-xs tracking-widest text-white uppercase"
				>
					Limit Order
				</span>
			{/if}
		</div>

		<!-- SKIP Indicator -->
		<div
			style="opacity: {skipOpacity}"
			class="absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-2xl border-4 border-slate-400 bg-white/95 px-10 py-5 text-5xl font-black tracking-tighter text-slate-400 shadow-2xl"
		>
			SKIP
		</div>

		<div
			class="flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[40px] border-none bg-white shadow-2xl transition-shadow hover:shadow-indigo-500/20 md:rounded-[48px]"
		>
			<!-- Header Gradient -->
			<div
				class="relative h-40 w-full shrink-0 items-center justify-center overflow-hidden bg-indigo-600 px-6 py-4 text-white md:h-56 md:px-8 md:py-10"
			>
				<!-- Abstract background pattern -->
				<div class="absolute inset-0 opacity-20">
					<div class="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-white blur-3xl"></div>
					<div
						class="absolute -right-32 -bottom-32 h-80 w-80 rounded-full bg-indigo-400 blur-3xl"
					></div>
				</div>

				<div class="relative z-10 flex h-full w-full flex-col items-center justify-center">
					<h2
						class="text-lg leading-[1.1] font-black tracking-tight wrap-break-word text-white sm:text-2xl md:text-3xl"
					>
						{market.title}
					</h2>
				</div>
			</div>

			<!-- Content -->
			<div
				class="flex h-full w-full flex-1 flex-col justify-between gap-6 px-6 py-8 md:px-8 md:py-10"
			>
				<div class="flex h-full flex-col gap-6">
					<p
						class="text-[13px] leading-relaxed wrap-break-word text-slate-600 sm:text-base md:text-slate-500"
					>
						{market.description}
					</p>

					{#if position}
						<div
							class="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5"
						>
							<div class="flex items-center gap-2">
								<div class="h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-500"></div>
								<span class="text-[10px] font-bold tracking-widest text-indigo-700 uppercase">
									Your Position
								</span>
							</div>
							<span class="text-sm font-black text-indigo-900">
								{formatToken({
									value: position.netQty,
									unitName: market.token.decimals
								})}
								{market.token.symbol}
							</span>
						</div>
					{/if}

					{#if !signedIn}
						<div
							class="mt-2 flex items-center justify-center gap-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
								/>
							</svg>
							Sign in to play
						</div>
					{/if}

					<div class="mt-auto grid grid-cols-2 gap-4">
						<BaseButton
							class="relative flex-col items-center rounded-[32px] border border-rose-100 bg-rose-50/50 p-6 transition-all hover:bg-rose-50! active:scale-95"
							onclick={() => onAction('NO')}
						>
							<span
								class="mb-1 block text-[10px] font-bold tracking-widest text-rose-500 uppercase"
							>
								NO
							</span>

							<span class="text-3xl font-black text-rose-600">
								{formatProbability(market.noProbability)}
							</span>

							{#if isLimitOrderNo}
								<div
									class="absolute top-4 left-4 rounded-full bg-rose-200 px-3 py-1 text-[8px] font-bold tracking-widest text-rose-700 uppercase"
								>
									Limit
								</div>
							{/if}
						</BaseButton>

						<BaseButton
							class="relative flex-col items-center rounded-[32px] border border-emerald-100 bg-emerald-50/50 p-6 transition-all hover:bg-emerald-50! active:scale-95"
							onclick={() => onAction('YES')}
						>
							<span
								class="mb-1 block text-[10px] font-bold tracking-widest text-emerald-500 uppercase"
							>
								YES
							</span>

							<span class="text-3xl font-black text-emerald-600">
								{formatProbability(market.yesProbability)}
							</span>

							{#if isLimitOrderYes}
								<div
									class="absolute top-4 right-4 rounded-full bg-emerald-200 px-3 py-1 text-[8px] font-bold tracking-widest text-emerald-700 uppercase"
								>
									Limit
								</div>
							{/if}
						</BaseButton>
					</div>
				</div>

				<div class="flex items-center justify-between border-t border-slate-100 pt-8">
					<div class="flex flex-col gap-1">
						<span class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
							Expires
						</span>
						<span class="text-base font-black text-slate-900">{formatDate(market.expiryDate)}</span>
					</div>

					<div
						class="flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 ring-1 ring-slate-100"
					>
						<span class="text-[10px] font-black tracking-widest text-slate-500 uppercase">
							Market Details
						</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style lang="postcss">
	.perspective-1000 {
		perspective: 1000px;
	}
</style>
