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

<div class="flex flex-col items-center space-y-5 text-center">
	<div class="border-border bg-foreground/5 shadow-card rounded-2xl border p-4">
		<div class="bg-card/70 flex h-48 w-48 items-center justify-center rounded-xl">
			<span class="text-muted-foreground text-xs font-bold">QR CODE PLACEHOLDER</span>
		</div>
	</div>
	<div class="space-y-2">
		<p class="eyebrow">Your Principal ID</p>
		{#if nonNullish(principalText)}
			<div
				class="border-border bg-foreground/5 text-primary shadow-card flex items-center justify-center rounded-xl border px-4 py-2 text-sm"
			>
				<CopyableAddress address={principalText} label="Principal ID" showSelfIndicator={false} />
			</div>
		{:else}
			<p class="text-muted-foreground text-sm italic">Loading...</p>
		{/if}
	</div>
</div>
