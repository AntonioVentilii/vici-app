<script lang="ts">
	import { Clock } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { AppPath } from '$lib/constants/routes.constants';
	import type { Market } from '$lib/types/market';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

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
	class="group border-border bg-card hover:border-primary/50 flex cursor-pointer flex-col items-start justify-between gap-2 rounded-xl border px-6 py-6 transition-all duration-500 hover:shadow-lg"
	onclick={() => goto(`${AppPath.Markets}/${market.id}`)}
	onkeydown={(e) => e.key === 'Enter' && goto(`/markets/${market.id}`)}
	role="link"
	tabindex="0"
>
	<div class="flex items-start gap-1.5">
		<div class="flex items-start justify-between gap-2">
			<h3
				class="text-foreground group-hover:text-primary text-lg leading-tight font-bold text-wrap wrap-break-word transition-colors"
			>
				{market.title}
			</h3>

			<!-- Status Badge -->
			<div class="flex">
				<span
					class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {market.status ===
					'Open'
						? 'border border-green-200 bg-green-100 text-green-700'
						: 'border border-red-200 bg-red-100 text-red-700'}"
				>
					{market.status}
				</span>
			</div>
		</div>

		<!--		Add tags -->
	</div>

	<div class="flex flex-col gap-4">
		<p class="text-muted-foreground text-sm text-wrap wrap-break-word">
			{market.description}
		</p>

		<!-- Probabilities Area -->
		<div class="grid grid-cols-2 gap-4 lg:gap-6">
			<a
				class="rounded-lg bg-green-50 p-2 text-center transition-all hover:bg-green-100 hover:shadow-sm"
				href="/(app)/markets/{market.id}?side=yes"
				onclick={(e) => e.stopPropagation()}
			>
				<div class="text-[10px] font-bold text-green-600 uppercase">Yes</div>
				<div class="text-xl font-black text-green-700">
					{Math.round(market.yesProbability * 100)}¢
				</div>
			</a>

			<a
				class="rounded-lg bg-red-50 p-2 text-center transition-all hover:bg-red-100 hover:shadow-sm"
				href="/(app)/markets/{market.id}?side=no"
				onclick={(e) => e.stopPropagation()}
			>
				<div class="text-[10px] font-bold text-red-600 uppercase">No</div>
				<div class="text-xl font-black text-red-700">{Math.round(market.noProbability * 100)}¢</div>
			</a>
		</div>

		<!-- Stats Grid -->
		<div class="flex items-center justify-between border-t border-slate-100 pt-3">
			<div class="flex flex-row items-center text-right">
				<div class="mr-1 inline text-[10px] font-bold text-slate-400 uppercase">
					<Clock size={12} />
				</div>
				<div class="inline text-xs font-bold text-slate-600">
					{getTimeRemaining(market.expiryDate)}
				</div>
			</div>
		</div>
	</div>
</div>
