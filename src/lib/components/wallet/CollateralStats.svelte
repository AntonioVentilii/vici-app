<script lang="ts">
	interface Props {
		collateral: bigint;
		onFormatBalance: (b: bigint) => string;
		onManage: () => void;
	}

	const { collateral, onFormatBalance, onManage }: Props = $props();
</script>

<div
	class="relative overflow-hidden rounded-3xl border border-indigo-100 bg-linear-to-br from-indigo-50 to-white p-8 shadow-sm md:col-span-2"
>
	<div class="flex items-center justify-between">
		<div>
			<div class="text-sm font-bold tracking-widest text-indigo-600 uppercase">
				Clearing Collateral
			</div>
			<p class="text-sm text-slate-500">Locked and available margin for trading</p>
		</div>
		<button
			class="rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 active:scale-[0.98]"
			onclick={onManage}
		>
			Manage Collateral
		</button>
	</div>
	<div class="mt-6 flex items-baseline gap-2">
		<span class="text-5xl font-black text-slate-950">{onFormatBalance(collateral)}</span>
		<span class="text-xl font-bold text-slate-400 uppercase">ICP</span>
	</div>
</div>
