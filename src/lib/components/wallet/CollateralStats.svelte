<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { SUPPORTED_TOKENS } from '$lib/constants/tokens/tokens.ic.constants';
	import type { TokenId } from '$lib/types/token';
	import { formatToken } from '$lib/utils/format.utils';

	interface Props {
		collateral: Record<TokenId, bigint>;
		onManage: () => void;
	}

	const { collateral, onManage }: Props = $props();

	const hasCollateral = $derived(
		SUPPORTED_TOKENS.some((token) => (collateral[token.id] ?? ZERO) > ZERO)
	);
</script>

<Card padding="lg" variant="default">
	<div class="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
		<div>
			<div class="text-xs font-bold tracking-widest text-indigo-600 uppercase">
				Clearing Collateral
			</div>
			<p class="mt-1 text-sm text-slate-500">Locked and available margin for trading</p>
		</div>

		<Button onclick={onManage} variant="primary">Manage Collateral</Button>
	</div>

	<div class="mt-8 flex flex-col gap-4">
		{#each SUPPORTED_TOKENS as token (token.id)}
			{@const balance = collateral[token.id] ?? ZERO}

			{#if balance > ZERO}
				<div class="flex items-baseline gap-2">
					<span class="text-3xl font-black text-slate-950">
						{formatToken({
							value: balance,
							unitName: token.decimals
						})}
					</span>
					<span class="text-sm font-bold text-slate-400 uppercase">
						{token.symbol}
					</span>
				</div>
			{/if}
		{/each}

		{#if !hasCollateral}
			<span class="text-3xl font-black text-slate-200">0.00</span>
		{/if}
	</div>
</Card>
