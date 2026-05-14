<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { walletUiTokens } from '$lib/derived/tokens.derived';
	import { isDev } from '$lib/env/app.env';
	import type { ButtonStatus } from '$lib/types/components';
	import type { Token } from '$lib/types/token';

	interface Props {
		recipient: string;
		amount: string;
		selectedToken: Token | undefined;
		sendStatus?: ButtonStatus;
		onRecipientChange: (v: string) => void;
		onAmountChange: (v: string) => void;
		onTokenChange: (v: Token) => void;
		onSend: () => void;
	}

	const {
		recipient,
		amount,
		selectedToken,
		sendStatus = 'enabled',
		onRecipientChange,
		onAmountChange,
		onTokenChange,
		onSend
	}: Props = $props();

	const isSelected = (token: Token) => selectedToken?.ledgerCanisterId === token.ledgerCanisterId;
</script>

<div class="max-w-xl space-y-6">
	<div class="space-y-2">
		<span class="text-muted-foreground text-xs font-bold tracking-wider uppercase">Token</span>
		<div class="grid grid-cols-2 gap-3">
			{#each $walletUiTokens as token (token.ledgerCanisterId)}
				<button
					class="flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 font-bold transition-all {isSelected(
						token
					)
						? 'border-primary bg-primary/10 text-primary'
						: 'border-border bg-foreground/5 text-muted-foreground hover:border-foreground/10'}"
					onclick={() => onTokenChange(token)}
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
		<label
			class="text-muted-foreground text-xs font-bold tracking-wider uppercase"
			for="recipient-principal"
		>
			Recipient
		</label>
		<input
			id="recipient-principal"
			class="bg-foreground/5 text-foreground ring-border focus:ring-primary w-full rounded-xl border-none px-4 py-3 ring-1 ring-inset focus:ring-2"
			oninput={(e) => onRecipientChange(e.currentTarget.value)}
			placeholder="aaaaa-aa..."
			type="text"
			value={recipient}
		/>
	</div>

	<div class="space-y-2">
		<label
			class="text-muted-foreground text-xs font-bold tracking-wider uppercase"
			for="send-amount"
		>
			Amount
		</label>
		<input
			id="send-amount"
			class="bg-foreground/5 text-foreground ring-border focus:ring-primary w-full rounded-xl border-none px-4 py-3 ring-1 ring-inset focus:ring-2"
			oninput={(e) => onAmountChange(e.currentTarget.value)}
			placeholder="0.00"
			type="number"
			value={amount}
		/>
	</div>

	<Button class="w-full py-4 text-sm font-black" onclick={onSend} status={sendStatus}>
		{#snippet busyLabel()}Sending...{/snippet}
		Send Tokens
	</Button>
</div>
