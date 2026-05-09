<script lang="ts">
	import SignInDev from '$lib/components/authn/SignInDev.svelte';
	import SignInGoogle from '$lib/components/authn/SignInGoogle.svelte';
	import SignInII from '$lib/components/authn/SignInII.svelte';
	import SignInPasskey from '$lib/components/authn/SignInPasskey.svelte';
	import { isDev, isE2E, isNotSkylab, isProd } from '$lib/env/app.env';
	import type { ButtonStatus } from '$lib/types/components';

	interface Props {
		onSuccess?: () => void;
	}

	const { onSuccess }: Props = $props();

	// Real II / passkey are normally only enabled in production. E2E unlocks
	// them against the Juno emulator so Playwright can drive the same flow
	// real users hit, instead of the dev-only mock identity.
	const prodStatus = $derived<ButtonStatus>(
		(isProd() && isNotSkylab()) || isE2E() ? 'enabled' : 'disabled'
	);
</script>

<div class="flex w-fit flex-col gap-2">
	{#if isDev()}
		<SignInDev {onSuccess} />
	{/if}

	<SignInGoogle {onSuccess} />

	<SignInII {onSuccess} status={prodStatus} />

	<SignInPasskey {onSuccess} status={prodStatus} />
</div>
