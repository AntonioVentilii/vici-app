<script lang="ts">
	import { goto } from '$app/navigation';
	import PopOver from '$lib/components/ui/PopOver.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { SUPPORTED_TOKENS } from '$lib/constants/tokens/tokens.ic.constants';
	import type { WalletBalance } from '$lib/types/wallet';
	import { formatToken } from '$lib/utils/format.utils';

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
		<button
			class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-all hover:bg-slate-200 hover:text-slate-900 active:scale-95"
			aria-label="Wallet"
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
		</button>
	{/snippet}

	{#snippet content()}
		<div class="w-64 p-2">
			<div class="mb-4">
				<h3 class="px-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">Balances</h3>
				<div class="mt-2 space-y-1">
					{#each SUPPORTED_TOKENS as token (token.id)}
						{@const balance = balances.balances[token.id] ?? ZERO}

						<div class="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors">
							<span class="text-sm font-medium text-slate-600">{token.symbol}</span>
							<span class="text-sm font-bold text-slate-900">
								{formatToken({ value: balance, unitName: token.decimals })}
							</span>
						</div>
					{/each}
				</div>
			</div>

			<div class="border-t border-slate-100 pt-2">
				<button
					class="w-full rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white transition-all hover:bg-indigo-700 active:scale-95"
					onclick={goToWallet}
				>
					Go to Wallet
				</button>
			</div>
		</div>
	{/snippet}
</PopOver>
