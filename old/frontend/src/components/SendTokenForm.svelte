<script lang="ts">
	import { wallet } from '../stores/wallet';
	import Button from './ui/Button.svelte';
	import Input from './ui/Input.svelte';
	import { Send, Info, AlertCircle } from 'lucide-svelte';
	import { Principal } from '@icp-sdk/core/principal';
	import { toast } from 'sonner';
	import type { WalletBalance } from '../backend';

	export let currentBalance: WalletBalance | undefined;

	let tokenType: 'icp' | 'ckUSDC' = 'icp';
	let recipient = '';
	let amount = '';
	let error = '';

	const validatePrincipal = (value: string): boolean => {
		try {
			Principal.fromText(value);
			return true;
		} catch {
			return false;
		}
	};

	const validateAmount = (value: string): boolean => {
		const num = parseFloat(value);
		if (isNaN(num) || num <= 0) return false;

		const balance = tokenType === 'icp' ? currentBalance?.icp : currentBalance?.ckUSDC;
		if (!balance) return false;

		// Convert to smallest unit (e8s)
		const amountInSmallestUnit = BigInt(Math.floor(num * 100_000_000));
		return amountInSmallestUnit <= balance;
	};

	const handleSubmit = async () => {
		error = '';

		if (!validatePrincipal(recipient)) {
			error = 'Invalid Principal ID format';
			return;
		}

		if (!validateAmount(amount)) {
			error = 'Invalid amount or insufficient balance';
			return;
		}

		toast.info('Send functionality not yet fully implemented', {
			description: 'This feature requires ledger canister integration'
		});

		recipient = '';
		amount = '';
	};

	$: currentTokenBalance = tokenType === 'icp' ? currentBalance?.icp : currentBalance?.ckUSDC;
	$: formattedBalance = currentTokenBalance
		? (Number(currentTokenBalance) / 100_000_000).toFixed(8)
		: '0.00';
</script>

<div class="space-y-6">
	<div class="flex items-start gap-2 rounded-lg bg-slate-100 p-4">
		<Info size={16} class="mt-1 flex-shrink-0" />
		<p class="text-sm">
			Token sending requires integration with ICP Ledger canisters. This feature will be available
			in a future update.
		</p>
	</div>

	<div class="space-y-6">
		<!-- Token Type Selection -->
		<div class="space-y-2">
			<label class="text-sm font-medium">Token Type</label>
			<div
				class="border-input flex h-10 w-full cursor-not-allowed rounded-md border bg-slate-50 px-3 py-2 text-sm opacity-50"
			>
				{tokenType.toUpperCase()}
			</div>
			<p class="text-muted-foreground text-sm">
				Available: {formattedBalance}
				{tokenType.toUpperCase()}
			</p>
		</div>

		<!-- Recipient Principal ID -->
		<div class="space-y-2">
			<label for="recipient" class="text-sm font-medium">Recipient Principal ID</label>
			<Input
				id="recipient"
				placeholder="xxxxx-xxxxx-xxxxx-xxxxx-xxx"
				bind:value={recipient}
				disabled
			/>
		</div>

		<!-- Amount -->
		<div class="space-y-2">
			<label for="amount" class="text-sm font-medium">Amount</label>
			<Input
				id="amount"
				type="number"
				step="0.00000001"
				placeholder="0.00"
				bind:value={amount}
				disabled
			/>
		</div>

		{#if error}
			<div class="flex items-center gap-2 rounded-lg bg-rose-50 p-4 text-rose-700">
				<AlertCircle size={16} />
				<p class="text-sm">{error}</p>
			</div>
		{/if}

		<Button className="w-full" disabled on:click={handleSubmit}>
			<Send size={16} class="mr-2" />
			Send {tokenType.toUpperCase()} (Coming Soon)
		</Button>
	</div>
</div>
