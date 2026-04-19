<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import type { Principal } from '@icp-sdk/core/principal';
	import { onMount } from 'svelte';
	import CopyableAddress from '$lib/components/ui/CopyableAddress.svelte';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';

	let principal = $state<Principal | undefined>();

	onMount(async () => {
		const identity = await safeGetIdentityOnce();

		principal = identity.getPrincipal();
	});

	const principalText = $derived(nonNullish(principal) ? principal.toText() : undefined);
</script>

<div class="flex flex-col items-center space-y-6 text-center">
	<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="flex h-48 w-48 items-center justify-center rounded-lg bg-slate-100">
			<!-- Placeholder QR -->
			<span class="text-xs font-bold text-slate-400">QR CODE PLACEHOLDER</span>
		</div>
	</div>
	<div class="space-y-2">
		<p class="text-sm font-bold tracking-widest text-slate-500 uppercase">Your Principal ID</p>
		{#if nonNullish(principalText)}
			<div
				class="flex items-center justify-center rounded-xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm text-indigo-600"
			>
				<CopyableAddress address={principalText} label="Principal ID" showSelfIndicator={false} />
			</div>
		{:else}
			<p class="text-sm text-slate-400 italic">Loading...</p>
		{/if}
	</div>
</div>
