<script lang="ts">
	import { goto } from '$app/navigation';
	import type { Market } from '$lib/types/market';

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

	const getTimeRemaining = (expiry: bigint) => {
		const now = BigInt(Date.now());

		const diff = Number(expiry - now);

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

<div
	class="group border-border bg-card hover:border-primary/50 relative flex cursor-pointer flex-col overflow-hidden rounded-lg border transition-all duration-500 hover:shadow-lg"
	onclick={() => goto(`/markets/${market.id}`)}
	onkeydown={(e) => e.key === 'Enter' && goto(`/markets/${market.id}`)}
	role="link"
	tabindex="0"
>
	<!-- Status Badge -->
	<div class="absolute top-4 right-4 z-20">
		<span
			class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {market.status ===
			'Open'
				? 'border border-green-200 bg-green-100 text-green-700'
				: 'border border-red-200 bg-red-100 text-red-700'}"
		>
			{market.status}
		</span>
	</div>

	<div class="p-4">
		<h3
			class="text-foreground group-hover:text-primary line-clamp-2 text-lg font-bold transition-colors"
		>
			{market.title}
		</h3>
		<p class="text-muted-foreground mt-1 line-clamp-2 text-xs">
			{market.description}
		</p>

		<!-- Probabilities Area -->
		<div class="mt-4 grid grid-cols-2 gap-2">
			<a
				class="rounded-lg bg-green-50 p-2 text-center transition-all hover:bg-green-100 hover:shadow-sm"
				href="/markets/{market.id}?side=yes"
				onclick={(e) => e.stopPropagation()}
			>
				<div class="text-[10px] font-bold text-green-600 uppercase">Yes</div>
				<div class="text-xl font-black text-green-700">
					{Math.round(market.yesProbability * 100)}¢
				</div>
			</a>
			<a
				class="rounded-lg bg-red-50 p-2 text-center transition-all hover:bg-red-100 hover:shadow-sm"
				href="/markets/{market.id}?side=no"
				onclick={(e) => e.stopPropagation()}
			>
				<div class="text-[10px] font-bold text-red-600 uppercase">No</div>
				<div class="text-xl font-black text-red-700">{Math.round(market.noProbability * 100)}¢</div>
			</a>
		</div>

		<!-- Stats Grid -->
		<div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
			<div class="flex items-center gap-2">
				<div class="text-[10px] font-bold text-slate-400 uppercase">Vol:</div>
				<div class="text-xs font-bold text-slate-600">
					{formatVolume(market.totalVolume)} ICP
				</div>
			</div>
			<div class="text-right">
				<div class="mr-1 inline text-[10px] font-bold text-slate-400 uppercase">Ends:</div>
				<div class="inline text-xs font-bold text-slate-600">
					{getTimeRemaining(market.expiryDate)}
				</div>
			</div>
		</div>
	</div>
</div>
