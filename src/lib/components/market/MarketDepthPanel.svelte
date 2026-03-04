<script lang="ts">
	import type { Market } from '$lib/types/market';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	const formatProbability = (p: number) => Math.round(p * 100);
</script>

<div class="space-y-8">
	<!-- Probability Overview -->
	<div class="grid grid-cols-2 gap-6">
		<div class="rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
			<div class="flex items-center justify-between">
				<span class="text-xs font-bold tracking-widest text-emerald-600 uppercase">YES Odds</span>
				<div class="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></div>
			</div>
			<div class="mt-4 flex items-baseline gap-2">
				<span class="text-4xl font-black text-emerald-950"
					>{formatProbability(market.yesProbability)}%</span
				>
				<span class="text-xs font-medium text-emerald-600">probability</span>
			</div>
			<div class="mt-4 h-1.5 w-full rounded-full bg-emerald-100">
				<div
					style="width: {market.yesProbability * 100}%"
					class="h-full rounded-full bg-emerald-500"
				></div>
			</div>
		</div>

		<div class="rounded-3xl border border-rose-100 bg-rose-50 p-6">
			<div class="flex items-center justify-between">
				<span class="text-xs font-bold tracking-widest text-rose-600 uppercase">NO Odds</span>
				<div class="h-2 w-2 animate-pulse rounded-full bg-rose-500"></div>
			</div>
			<div class="mt-4 flex items-baseline gap-2">
				<span class="text-4xl font-black text-rose-950"
					>{formatProbability(market.noProbability)}%</span
				>
				<span class="text-xs font-medium text-rose-600">probability</span>
			</div>
			<div class="mt-4 h-1.5 w-full rounded-full bg-rose-100">
				<div
					style="width: {market.noProbability * 100}%"
					class="h-full rounded-full bg-rose-500"
				></div>
			</div>
		</div>
	</div>

	<!-- Depth Table Placeholder -->
	<div class="overflow-hidden rounded-3xl border border-slate-200 bg-white p-8">
		<div class="mb-6 flex items-center justify-between">
			<h4 class="text-sm font-bold tracking-widest text-slate-950 uppercase">Market Depth</h4>
			<span
				class="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500 uppercase"
			>
				Coming Soon
			</span>
		</div>

		<div class="relative">
			<table class="w-full text-left opacity-30 blur-[1px] select-none">
				<thead>
					<tr
						class="border-b border-slate-100 text-[10px] font-bold tracking-wider text-slate-400 uppercase"
					>
						<th class="pb-4">Trader</th>
						<th class="pb-4">Position</th>
						<th class="pb-4">Price</th>
						<th class="pb-4 text-right">Amount</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-50">
					{#each [1, 2, 3] as i (i)}
						<tr class="text-sm">
							<td class="py-4 font-mono text-xs">P...{i}xyz</td>
							<td class="py-4">
								<span
									class="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600"
									>YES</span
								>
							</td>
							<td class="py-4 font-bold">0.65 ICP</td>
							<td class="py-4 text-right font-black">150.00</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<div class="absolute inset-0 flex items-center justify-center text-center">
				<div class="max-w-xs px-4">
					<p class="text-sm font-bold tracking-widest text-slate-950 uppercase">
						Live Order Book coming
					</p>
					<p class="mt-1 text-xs text-slate-500">
						Global market liquidity and real-time depth will be available in the next Clearing
						update.
					</p>
				</div>
			</div>
		</div>
	</div>
</div>
