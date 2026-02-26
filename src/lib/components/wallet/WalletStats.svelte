<script lang="ts">
	import type { WalletBalance } from '$lib/types/wallet';

	interface Props {
		balances: WalletBalance;
		onFormatBalance: (b: bigint) => string;
	}

	const { balances, onFormatBalance }: Props = $props();
</script>

<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
	<div
		class="relative overflow-hidden rounded-3xl border border-indigo-100 bg-linear-to-br from-indigo-50 to-white p-8 shadow-sm"
	>
		<div class="flex items-center justify-between">
			<div class="text-sm font-bold tracking-widest text-indigo-600 uppercase">ICP Balance</div>
			<div class="h-8 w-8 rounded-full bg-indigo-100 p-1.5 text-indigo-600">
				<svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 12l10 10 10-10L12 2z" /></svg>
			</div>
		</div>
		<div class="mt-4 flex items-baseline gap-2">
			<span class="text-5xl font-black text-slate-950">{onFormatBalance(balances.icp)}</span>
			<span class="text-xl font-bold text-slate-400 uppercase">ICP</span>
		</div>
		<div class="mt-6 flex gap-3 text-xs font-medium text-slate-500">
			<span>≈ ${((Number(balances.icp) / 100_000_000) * 12.5).toFixed(2)} USD</span>
		</div>
	</div>

	<div
		class="relative overflow-hidden rounded-3xl border border-green-100 bg-linear-to-br from-green-50 to-white p-8 shadow-sm"
	>
		<div class="flex items-center justify-between">
			<div class="text-sm font-bold tracking-widest text-green-600 uppercase">ckUSDC Balance</div>
			<div class="h-8 w-8 rounded-full bg-green-100 p-1.5 text-green-600">
				<svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 12l10 10 10-10L12 2z" /></svg>
			</div>
		</div>
		<div class="mt-4 flex items-baseline gap-2">
			<span class="text-5xl font-black text-slate-950">{onFormatBalance(balances.ckUsdc)}</span>
			<span class="text-xl font-bold text-slate-400 uppercase">ckUSDC</span>
		</div>
		<div class="mt-6 flex gap-3 text-xs font-medium text-slate-500">
			<span>1.00 ckUSDC = $1.00 USD</span>
		</div>
	</div>
</div>
