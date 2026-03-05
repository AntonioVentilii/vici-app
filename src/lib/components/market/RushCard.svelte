<script lang="ts">
	import { Spring } from 'svelte/motion';
	import type { Market } from '$lib/types/market';

	interface Props {
		market: Market;
		onAction: (action: 'YES' | 'NO' | 'SKIP') => void;
	}

	const { market, onAction }: Props = $props();

	let startX = 0;
	let startY = 0;
	let dragging = false;

	const coords = new Spring(
		{ x: 0, y: 0 },
		{
			stiffness: 0.2,
			damping: 0.4
		}
	);

	const rotation = $derived($coords.x / 10);
	const opacity = $derived(
		1 - Math.min(Math.abs($coords.x) / 400 + Math.abs($coords.y) / 400, 0.5)
	);

	// Action indicators
	const yesOpacity = $derived(Math.max(0, $coords.x / 100));
	const noOpacity = $derived(Math.max(0, -$coords.x / 100));
	const skipOpacity = $derived(Math.max(0, -$coords.y / 100));

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

	// eslint-disable-next-line require-await
	const handleEnd = async () => {
		if (!dragging) {
			return;
		}
		dragging = false;

		const threshold = 150;
		if ($coords.x > threshold) {
			onAction('YES');
		} else if ($coords.x < -threshold) {
			onAction('NO');
		} else if ($coords.y < -threshold) {
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
	class="perspective-1000 relative flex h-full w-full items-center justify-center"
	onmouseleave={handleEnd}
	onmousemove={handleMove}
	onmouseup={handleEnd}
	ontouchend={handleEnd}
	ontouchmove={handleMove}
	role="presentation"
>
	<div
		style="transform: translate3d({$coords.x}px, {$coords.y}px, 0) rotate({rotation}deg); opacity: {opacity}"
		class="relative h-125 w-full max-w-90 cursor-grab select-none active:cursor-grabbing"
		onmousedown={handleStart}
		ontouchstart={handleStart}
		role="presentation"
	>
		<!-- YES Indicator -->
		<div
			style="opacity: {yesOpacity}; transform: rotate(-15deg)"
			class="absolute top-10 left-6 z-20 rounded border-4 border-emerald-500 px-4 py-2 text-3xl font-black text-emerald-500"
		>
			YES
		</div>

		<!-- NO Indicator -->
		<div
			style="opacity: {noOpacity}; transform: rotate(15deg)"
			class="absolute top-10 right-6 z-20 rounded border-4 border-rose-500 px-4 py-2 text-3xl font-black text-rose-500"
		>
			NO
		</div>

		<!-- SKIP Indicator -->
		<div
			style="opacity: {skipOpacity}"
			class="absolute bottom-10 left-1/2 z-20 -translate-x-1/2 rounded border-4 border-slate-400 px-4 py-2 text-3xl font-black text-slate-400"
		>
			SKIP
		</div>

		<div
			class="h-full w-full overflow-hidden rounded-[40px] border border-slate-200 bg-white shadow-2xl transition-shadow hover:shadow-indigo-500/10"
		>
			<!-- Header -->
			<div class="relative h-48 bg-indigo-600 p-8 text-white">
				<div
					class="absolute inset-0 bg-linear-to-br from-indigo-500 to-indigo-700 opacity-50"
				></div>
				<div class="relative z-10">
					<div class="mb-4 flex items-center gap-2">
						<span
							class="rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold tracking-widest uppercase backdrop-blur-sm"
						>
							Prediction Market
						</span>
					</div>
					<h2 class="line-clamp-3 text-2xl leading-tight font-black">
						{market.title}
					</h2>
				</div>
			</div>

			<!-- Content -->
			<div class="flex h-[calc(100%-192px)] flex-col justify-between p-8">
				<div>
					<p class="mb-6 line-clamp-4 leading-relaxed text-slate-600">
						{market.description}
					</p>

					<div class="grid grid-cols-2 gap-4">
						<div class="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
							<span
								class="mb-1 block text-[10px] font-bold tracking-wider text-emerald-600 uppercase"
								>YES Odds</span
							>
							<span class="text-2xl font-black text-emerald-700"
								>{(market.yesProbability * 100).toFixed(0)}%</span
							>
						</div>
						<div class="rounded-2xl border border-rose-100 bg-rose-50 p-4">
							<span class="mb-1 block text-[10px] font-bold tracking-wider text-rose-600 uppercase"
								>NO Odds</span
							>
							<span class="text-2xl font-black text-rose-700"
								>{(market.noProbability * 100).toFixed(0)}%</span
							>
						</div>
					</div>
				</div>

				<div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-6">
					<div class="flex flex-col">
						<span class="text-[10px] font-bold tracking-wider text-slate-400 uppercase"
							>Expires</span
						>
						<span class="text-sm font-bold text-slate-950">{formatDate(market.expiryDate)}</span>
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
