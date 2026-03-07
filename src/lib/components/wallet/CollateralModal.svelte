<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import { SUPPORTED_TOKENS } from '$lib/constants/tokens/tokens.ic.constants';
	import { isDev } from '$lib/env/app.env';
	import { depositCollateral, withdrawCollateral } from '$lib/services/collateral.services';
	import type { Token } from '$lib/types/token';
	import { parseToken } from '$lib/utils/parse.utils';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	const { isOpen, onClose }: Props = $props();

	let amount = $state('');

	let mode = $state<'Deposit' | 'Withdraw'>('Deposit');

	let selectedToken = $state<Token>(SUPPORTED_TOKENS[0]);

	let loading = $state(false);

	let error = $state('');

	const reset = () => {
		amount = '';
		mode = 'Deposit';
		[selectedToken] = SUPPORTED_TOKENS;
		loading = false;
		error = '';
	};

	const close = () => {
		reset();
		onClose();
	};

	const handleSubmit = async () => {
		if (!amount || parseFloat(amount) <= 0) {
			error = 'Please enter a valid amount';
			return;
		}

		loading = true;
		error = '';

		try {
			const amt = parseToken({ value: `${amount}`, unitName: selectedToken.decimals });

			if (mode === 'Deposit') {
				await depositCollateral({
					assetPrincipal: selectedToken.ledgerCanisterId,
					amount: amt
				});
			} else {
				await withdrawCollateral({
					assetPrincipal: selectedToken.ledgerCanisterId,
					amount: amt
				});
			}

			close();
		} catch (e: unknown) {
			error = (e as Error).message ?? 'Operation failed';
		} finally {
			loading = false;
		}
	};
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
		<button
			class="fixed inset-0 bg-slate-950/40"
			aria-label="Close modal"
			onclick={close}
			type="button"
		>
		</button>

		<div
			class="animate-in fade-in zoom-in relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl duration-200"
		>
			<button
				class="absolute top-6 right-6 text-slate-400 hover:text-slate-600"
				aria-label="Close modal"
				onclick={close}
				type="button"
			>
				<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						d="M6 18L18 6M6 6l12 12"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
					/>
				</svg>
			</button>

			<h3 class="text-2xl font-black text-slate-950 uppercase">{mode} Collateral</h3>
			<p class="mt-2 text-sm text-slate-500">Manage your market margin account collateral.</p>

			<div class="mt-8 flex rounded-2xl bg-slate-100 p-1">
				<button
					class="flex-1 rounded-xl py-2 text-sm font-bold transition-all {mode === 'Deposit'
						? 'bg-white text-slate-950 shadow-sm'
						: 'text-slate-500 hover:text-slate-700'}"
					onclick={() => (mode = 'Deposit')}
					type="button"
				>
					Deposit
				</button>

				<button
					class="flex-1 rounded-xl py-2 text-sm font-bold transition-all {mode === 'Withdraw'
						? 'bg-white text-slate-950 shadow-sm'
						: 'text-slate-500 hover:text-slate-700'}"
					onclick={() => (mode = 'Withdraw')}
					type="button"
				>
					Withdraw
				</button>
			</div>

			<div class="mt-8 space-y-6">
				<div class="space-y-2">
					<span class="text-xs font-bold tracking-widest text-slate-500 uppercase">Token</span>
					<div class="grid grid-cols-2 gap-3">
						{#each SUPPORTED_TOKENS as token (token.ledgerCanisterId)}
							<button
								class="flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 font-bold transition-all {selectedToken.ledgerCanisterId ===
								token.ledgerCanisterId
									? 'border-indigo-600 bg-indigo-50 text-indigo-600'
									: 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}"
								onclick={() => (selectedToken = token)}
								type="button"
							>
								{token.symbol}
								{#if isDev() && token.isDevEnabled}
									<Badge size="sm" variant="warning">DEV</Badge>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				<div class="space-y-2">
					<label class="text-xs font-bold tracking-widest text-slate-500 uppercase" for="amount"
						>Amount ({selectedToken.symbol})</label
					>
					<div class="relative">
						<input
							id="amount"
							class="w-full rounded-2xl border-none bg-slate-50 px-6 py-4 text-xl font-bold text-slate-950 ring-1 ring-slate-200 ring-inset focus:bg-white focus:ring-2 focus:ring-indigo-500"
							placeholder="0.00"
							type="number"
							bind:value={amount}
						/>
						<span class="absolute top-1/2 right-4 -translate-y-1/2 font-bold text-slate-400"
							>{selectedToken.symbol}</span
						>
					</div>
				</div>

				{#if error}
					<div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
						{error}
					</div>
				{/if}

				<button
					class="w-full rounded-2xl bg-indigo-600 py-4 text-lg font-black text-white shadow-xl shadow-indigo-500/20 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
					disabled={loading || !amount}
					onclick={handleSubmit}
					type="button"
				>
					{#if loading}
						<div class="flex items-center justify-center gap-2">
							<div
								class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
							></div>
							Processing...
						</div>
					{:else}
						Confirm {mode}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
