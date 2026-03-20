<script lang="ts">
	import { Spring } from 'svelte/motion';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
	import { formatCurrency, formatProbability } from '$lib/utils/format.utils';

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
	class="perspective-1000 relative flex h-full w-full items-center justify-center p-4 sm:p-0"
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
		class="relative h-[550px] w-full max-w-[380px] cursor-grab select-none active:cursor-grabbing sm:h-[600px]"
		onmousedown={handleStart}
		ontouchstart={handleStart}
		role="presentation"
	>
		<!-- YES Indicator -->
		<div
			style="opacity: {signedIn ? yesOpacity : yesOpacity * 0.5}; transform: rotate(-12deg)"
			class="absolute top-12 left-8 z-20 flex flex-col items-center rounded-xl border-4 border-emerald-500 bg-white/90 px-6 py-3 shadow-xl"
		>
			<span class="text-4xl font-black tracking-tight text-emerald-500">YES</span>
			<div class="mt-1 flex flex-col items-center">
				<span class="text-lg font-black text-emerald-600">
					+{potentialReturnYes.toFixed(2)}
				</span>
				<span class="text-[8px] font-bold tracking-widest text-emerald-500 uppercase">
					Potential
				</span>
			</div>
			{#if isLimitOrderYes}
				<span
					class="mt-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] tracking-widest text-white uppercase"
				>
					Limit Order
				</span>
			{/if}
		</div>

		<!-- NO Indicator -->
		<div
			style="opacity: {signedIn ? noOpacity : noOpacity * 0.5}; transform: rotate(12deg)"
			class="absolute top-12 right-8 z-20 flex flex-col items-center rounded-xl border-4 border-rose-500 bg-white/90 px-6 py-3 shadow-xl"
		>
			<span class="text-4xl font-black tracking-tight text-rose-500">NO</span>
			<div class="mt-1 flex flex-col items-center">
				<span class="text-lg font-black text-rose-600">
					+{potentialReturnNo.toFixed(2)}
				</span>
				<span class="text-[8px] font-bold tracking-widest text-rose-500 uppercase">
					Potential
				</span>
			</div>
			{#if isLimitOrderNo}
				<span
					class="mt-2 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] tracking-widest text-white uppercase"
				>
					Limit Order
				</span>
			{/if}
		</div>

		<!-- SKIP Indicator -->
		<div
			style="opacity: {skipOpacity}"
			class="absolute bottom-12 left-1/2 z-20 -translate-x-1/2 rounded-xl border-4 border-slate-400 bg-white/90 px-6 py-3 text-4xl font-black tracking-tight text-slate-400 shadow-xl"
		>
			SKIP
		</div>

		<div
			class="flex h-full w-full flex-col overflow-hidden rounded-[48px] border-none bg-white shadow-2xl transition-shadow hover:shadow-indigo-500/20"
		>
			<!-- Header Gradient -->
			<div
				class="relative h-48 w-full shrink-0 overflow-hidden bg-indigo-600 p-10 text-white sm:h-56"
			>
				<!-- Abstract background pattern -->
				<div class="absolute inset-0 opacity-20">
					<div class="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-white blur-3xl"></div>
					<div
						class="absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-indigo-400 blur-3xl"
					></div>
				</div>

				<div class="relative z-10 flex h-full flex-col justify-end">
					<h2
						class="text-2xl leading-tight font-black tracking-tight text-wrap wrap-break-word sm:text-3xl"
					>
						{market.title}
					</h2>
				</div>
			</div>

			<!-- Content -->
			<div class="flex flex-1 flex-col justify-between gap-6 p-10">
				<div class="flex flex-col gap-6">
					<p class="text-sm leading-relaxed text-wrap wrap-break-word text-slate-500 sm:text-base">
						{market.description}
					</p>

					<div class="grid grid-cols-2 gap-4">
						<div
							class="flex flex-col items-center rounded-3xl border border-rose-100 bg-rose-50/50 p-5 transition-colors hover:bg-rose-50"
						>
							<span
								class="mb-1 block text-[10px] font-bold tracking-widest text-rose-500 uppercase"
							>
								NO Odds
							</span>

							<span class="text-3xl font-black text-rose-600">
								{formatProbability(market.noProbability)}
							</span>

							{#if isLimitOrderNo}
								<div
									class="mt-1 inline-block rounded-full bg-rose-200 px-2.5 py-1 text-[8px] font-bold tracking-widest text-rose-700 uppercase"
								>
									Limit
								</div>
							{/if}
						</div>

						<div
							class="flex flex-col items-center rounded-3xl border border-emerald-100 bg-emerald-50/50 p-5 transition-colors hover:bg-emerald-50"
						>
							<span
								class="mb-1 block text-[10px] font-bold tracking-widest text-emerald-500 uppercase"
							>
								YES Odds
							</span>

							<span class="text-3xl font-black text-emerald-600">
								{formatProbability(market.yesProbability)}
							</span>

							{#if isLimitOrderYes}
								<div
									class="mt-1 inline-block rounded-full bg-emerald-200 px-2.5 py-1 text-[8px] font-bold tracking-widest text-emerald-700 uppercase"
								>
									Limit
								</div>
							{/if}
						</div>
					</div>

					{#if position}
						<div
							class="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4"
						>
							<div class="flex items-center gap-2">
								<div class="h-2 w-2 animate-pulse rounded-full bg-indigo-500"></div>
								<span class="text-[10px] font-bold tracking-widest text-indigo-700 uppercase">
									Your Position
								</span>
							</div>
							<span class="text-xs font-black text-indigo-900">
								{formatCurrency({
									value: position.netQty,
									decimals: Number(market.token.decimals)
								})}
								{market.token.symbol}
							</span>
						</div>
					{/if}

					{#if !signedIn}
						<div
							class="mt-2 flex items-center justify-center gap-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase"
						>
							<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
				</div>

				<div class="flex items-center justify-between border-t border-slate-100 pt-6">
					<div class="flex flex-col gap-1">
						<span class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
							Expires
						</span>
						<span class="text-sm font-black text-slate-900">{formatDate(market.expiryDate)}</span>
					</div>

					<div class="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2">
						<span class="text-[10px] font-black tracking-widest text-slate-600 uppercase">
							Swipe to play
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
