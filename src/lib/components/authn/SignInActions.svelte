<script lang="ts">
	import SignInDev from '$lib/components/authn/SignInDev.svelte';
	import SignInGoogle from '$lib/components/authn/SignInGoogle.svelte';
	import SignInII from '$lib/components/authn/SignInII.svelte';
	import SignInPasskey from '$lib/components/authn/SignInPasskey.svelte';
	import { isDev, isNotSkylab, isProd } from '$lib/env/app.env';

	interface Props {
		onSuccess?: () => void;
	}

	const { onSuccess }: Props = $props();
</script>

<div class="flex w-fit flex-col gap-2">
	{#if isDev()}
		<SignInDev {onSuccess} />
	{/if}

	{#if isProd() && isNotSkylab()}
		<SignInGoogle {onSuccess} />

		<SignInII {onSuccess} />

		<SignInPasskey {onSuccess} />
	{/if}
</div>
