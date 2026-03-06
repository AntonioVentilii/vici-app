<script lang="ts">
	import type { WalletBalance } from '$lib/types/wallet';
	import { formatToken } from '$lib/utils/format.utils';

	interface Props {
		balances: WalletBalance;
	}

	const { balances }: Props = $props();
</script>

<div class="grid grid-cols-1 gap-4">
	<div
		class="relative overflow-hidden rounded-2xl border border-indigo-100 bg-linear-to-br from-indigo-50 to-white p-6 shadow-sm"
	>
		<div class="flex items-center justify-between">
			<div class="text-xs font-bold tracking-widest text-indigo-600 uppercase">ICP Balance</div>
			<div class="h-7 w-7 rounded-full bg-indigo-100 p-1.5 text-indigo-600">
				<svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 12l10 10 10-10L12 2z" /></svg>
			</div>
		</div>
		<div class="mt-2 flex items-baseline gap-2">
			<span class="text-3xl font-black text-slate-950">
				{formatToken({ value: balances.icp, unitName: 8 })}
			</span>
			<span class="text-lg font-bold text-slate-400 uppercase">ICP</span>
		</div>
		<div class="mt-4 flex gap-3 text-[10px] font-medium text-slate-500">
			<span>≈ ${((Number(balances.icp) / 100_000_000) * 12.5).toFixed(2)} USD</span>
		</div>
	</div>
	-
	<div
		class="relative overflow-hidden rounded-2xl border border-green-100 bg-linear-to-br from-green-50 to-white p-6 shadow-sm"
	>
		<div class="flex items-center justify-between">
			<div class="text-xs font-bold tracking-widest text-green-600 uppercase">ckUSDC Balance</div>
			<div class="h-7 w-7 rounded-full bg-green-100 p-1.5 text-green-600">
				<svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 12l10 10 10-10L12 2z" /></svg>
			</div>
		</div>
		<div class="mt-2 flex items-baseline gap-2">
			<span class="text-3xl font-black text-slate-950">
				{formatToken({ value: balances.ckUsdc, unitName: 6 })}
			</span>
			<span class="text-lg font-bold text-slate-400 uppercase">ckUSDC</span>
		</div>
		<div class="mt-4 flex gap-3 text-[10px] font-medium text-slate-500">
			<span>1.00 ckUSDC = $1.00 USD</span>
		</div>
	</div>
</div>
