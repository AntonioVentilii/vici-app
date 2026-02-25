<script lang="ts">
	import type { Market } from '$lib/services/mockBackend';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	const formatVolume = (v: bigint) => {
		const val = Number(v) / 100_000_000;
		if (val >= 1000) {
			return `${(val / 1000).toFixed(1)}k`;
		}
		return val.toFixed(0);
	};

	const getTimeRemaining = (expiry: number) => {
		const now = Date.now();
		const diff = expiry - now;
		if (diff <= 0) {
			return 'Expired';
		}

		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

		if (days > 0) {
			return `${days}d ${hours}h`;
		}
		return `${hours}h remaining`;
	};
</script>

<a
	class="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all duration-500 hover:border-indigo-500/50 hover:bg-white/[0.07] hover:shadow-[0_0_40px_-10px_rgba(99,102,241,0.2)]"
	href="/markets/{market.id}"
>
	<!-- Status Badge -->
	<div class="absolute top-4 right-4 z-20">
		<span
			class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium backdrop-blur-md {market.status ===
			'Open'
				? 'border border-green-500/20 bg-green-500/20 text-green-400'
				: 'border border-red-500/20 bg-red-500/20 text-red-400'}"
		>
			{market.status}
		</span>
	</div>

	<div class="p-6">
		<h3
			class="line-clamp-2 text-xl font-bold text-white transition-colors group-hover:text-indigo-400"
		>
			{market.title}
		</h3>
		<p class="mt-2 line-clamp-2 text-sm text-gray-400">
			{market.description}
		</p>

		<!-- Probabilities Area -->
		<div class="mt-6">
			<div
				class="flex items-center justify-between text-xs font-bold tracking-wider text-gray-500 uppercase"
			>
				<span>YES Probability</span>
				<span>{Math.round(market.yesProbability * 100)}%</span>
			</div>
			<div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5">
				<div
					style="width: {market.yesProbability * 100}%"
					class="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-1000 ease-out"
				></div>
			</div>
		</div>

		<!-- Stats Grid -->
		<div class="mt-8 grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
			<div>
				<div class="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Volume</div>
				<div class="mt-1 text-sm font-bold text-white uppercase">
					{formatVolume(market.totalVolume)} ICP
				</div>
			</div>
			<div class="text-right">
				<div class="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Ends In</div>
				<div class="mt-1 text-sm font-bold text-white">{getTimeRemaining(market.expiryDate)}</div>
			</div>
		</div>
	</div>

	<!-- Quick Action Overlay (Hidden until hover) -->
	<div
		class="absolute inset-0 z-10 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-sm transition-all duration-500 group-hover:opacity-100"
	>
		<div
			class="flex translate-y-4 gap-3 transition-transform duration-500 group-hover:translate-y-0"
		>
			<button
				class="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-xl shadow-indigo-500/20 transition-all hover:scale-110 hover:bg-indigo-500 active:scale-95"
			>
				Bet YES
			</button>
			<button
				class="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-bold text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-white/20 active:scale-95"
			>
				Details
			</button>
		</div>
	</div>
</a>
