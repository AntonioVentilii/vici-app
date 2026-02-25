<script lang="ts">
	interface Props {
		recipient: string;
		amount: string;
		selectedToken: 'ICP' | 'ckUSDC';
		onRecipientChange: (v: string) => void;
		onAmountChange: (v: string) => void;
		onTokenChange: (v: 'ICP' | 'ckUSDC') => void;
		onSend: () => void;
	}

	const {
		recipient,
		amount,
		selectedToken,
		onRecipientChange,
		onAmountChange,
		onTokenChange,
		onSend
	}: Props = $props();
</script>

<div class="max-w-xl space-y-6">
	<div class="space-y-2">
		<span class="text-xs font-bold tracking-wider text-slate-500 uppercase">Token</span>
		<div class="grid grid-cols-2 gap-4">
			<button
				class="rounded-xl border-2 px-4 py-3 font-bold transition-all {selectedToken === 'ICP'
					? 'border-indigo-600 bg-indigo-50 text-indigo-600'
					: 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}"
				onclick={() => onTokenChange('ICP')}
			>
				ICP
			</button>
			<button
				class="rounded-xl border-2 px-4 py-3 font-bold transition-all {selectedToken === 'ckUSDC'
					? 'border-green-600 bg-green-50 text-green-600'
					: 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}"
				onclick={() => onTokenChange('ckUSDC')}
			>
				ckUSDC
			</button>
		</div>
	</div>

	<div class="space-y-2">
		<label
			class="text-xs font-bold tracking-wider text-slate-500 uppercase"
			for="recipient-principal"
		>
			Recipient Principal
		</label>
		<input
			id="recipient-principal"
			class="w-full rounded-xl border-none bg-slate-50 px-4 py-3 text-slate-950 ring-1 ring-slate-200 ring-inset focus:ring-2 focus:ring-indigo-600"
			oninput={(e) => onRecipientChange(e.currentTarget.value)}
			placeholder="aaaaa-aa..."
			type="text"
			value={recipient}
		/>
	</div>

	<div class="space-y-2">
		<label class="text-xs font-bold tracking-wider text-slate-500 uppercase" for="send-amount"
			>Amount</label
		>
		<input
			id="send-amount"
			class="w-full rounded-xl border-none bg-slate-50 px-4 py-3 text-slate-950 ring-1 ring-slate-200 ring-inset focus:ring-2 focus:ring-indigo-600"
			oninput={(e) => onAmountChange(e.currentTarget.value)}
			placeholder="0.00"
			type="number"
			value={amount}
		/>
	</div>

	<button
		class="w-full rounded-xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 active:scale-[0.98]"
		onclick={onSend}
	>
		Send Tokens
	</button>
</div>
