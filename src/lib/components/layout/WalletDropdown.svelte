<script lang="ts">
	import { goto } from '$app/navigation';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import PopOver from '$lib/components/ui/PopOver.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { VXP_BALANCE_DISPLAY_DECIMALS } from '$lib/constants/playground.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { walletUiTokens } from '$lib/derived/tokens.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import type { WalletBalance } from '$lib/types/wallet';
	import { formatToken } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		balances: WalletBalance;
	}

	let { balances }: Props = $props();

	let open = $state(false);

	const goToWallet = () => {
		open = false;

		goto(AppPath.Wallet);
	};
</script>

<PopOver bind:open>
	{#snippet trigger()}
		<BaseButton
			class="bg-foreground/5 text-muted-foreground hover:bg-foreground/8 hover:text-foreground h-10 w-10 rounded-full active:scale-95"
			aria-label={t({ locale: $localeStore, key: 'wallet.title' })}
		>
			<svg
				fill="none"
				height="20"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				viewBox="0 0 24 24"
				width="20"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
				<path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
				<path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
			</svg>
		</BaseButton>
	{/snippet}

	{#snippet content()}
		<div class="w-64 p-2">
			<div class="mb-4">
				<h3 class="text-muted-foreground px-2 text-xs font-semibold tracking-wider uppercase">
					{t({ locale: $localeStore, key: 'layout.wallet.balances' })}
				</h3>
				<div class="mt-2 space-y-1">
					{#each $walletUiTokens as token (token.id)}
						{@const walletBalance = balances.balances[token.id] ?? ZERO}
						{@const collateralBalance = balances.collateral[token.id] ?? ZERO}
						{@const totalBalance = walletBalance + collateralBalance}

						<div class="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors">
							<span class="text-muted-foreground text-sm font-medium">{token.symbol}</span>
							<span class="text-foreground text-sm font-bold">
								{formatToken({
									value: totalBalance,
									unitName: token.decimals,
									displayDecimals:
										token.symbol === VXP_TOKEN.symbol ? VXP_BALANCE_DISPLAY_DECIMALS : undefined
								})}
							</span>
						</div>
					{/each}
				</div>
			</div>

			<div class="border-border border-t pt-2">
				<BaseButton
					class="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-4 py-2 text-center text-sm font-semibold active:scale-95"
					onclick={goToWallet}
				>
					{t({ locale: $localeStore, key: 'layout.wallet.go_to_wallet' })}
				</BaseButton>
			</div>
		</div>
	{/snippet}
</PopOver>
