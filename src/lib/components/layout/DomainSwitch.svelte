<script lang="ts">
	import { ShieldCheck, FlaskConical } from 'lucide-svelte/icons';
	import { TestId } from '$lib/constants/test-ids.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { isDev } from '$lib/env/app.env';
	import { setBalanceDomain } from '$lib/services/balance-domain.services';
	import type { BalanceDomainKey } from '$lib/types/balance-domain';
	import { isPlayground, isSettlement } from '$lib/utils/balance-domain.utils';

	const setDomain = (domain: BalanceDomainKey) => {
		// Disabled for now in prod
		if (domain === 'settlement' && !isDev()) {
			return;
		}

		setBalanceDomain(domain);
	};

	const setPlaygroundDomain = () => setDomain('playground');

	const setSettlementDomain = () => setDomain('settlement');
</script>

<div class="px-4 py-2">
	<div class="text-muted-foreground mb-2 text-[10px] font-bold tracking-widest uppercase">
		Domain Balance
	</div>
	<div class="flex gap-1">
		<button
			class="flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border p-2 transition-all {isPlayground(
				$balanceDomain
			)
				? 'border-primary bg-primary/10 text-primary shadow-sm'
				: 'border-border text-muted-foreground hover:bg-muted'}"
			aria-label="Playground domain"
			data-tid={TestId.PlaygroundDomain}
			onclick={setPlaygroundDomain}
		>
			<FlaskConical size={16} />
			<span class="text-[9px] font-bold">PLAYGROUND</span>
		</button>
		<button
			class="relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border p-2 transition-all {isSettlement(
				$balanceDomain
			)
				? 'border-primary bg-primary/10 text-primary shadow-sm'
				: !isDev()
					? 'border-border text-muted-foreground hover:bg-muted cursor-not-allowed opacity-50'
					: 'border-border text-muted-foreground hover:bg-muted active:scale-95'}"
			aria-label={isDev() ? 'Settlement domain' : 'Settlement domain (Disabled)'}
			data-tid={TestId.SettlementDomain}
			disabled={!isDev()}
			onclick={setSettlementDomain}
		>
			<ShieldCheck size={16} />
			<span class="text-[9px] font-bold">SETTLEMENT</span>
			{#if !isDev()}
				<span
					class="absolute -top-1 -right-1 flex h-3 w-6 items-center justify-center rounded-full bg-slate-200 text-[7px] font-black tracking-tighter text-slate-500 uppercase"
					>SOON</span
				>
			{/if}
		</button>
	</div>
</div>
