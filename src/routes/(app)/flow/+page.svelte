<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import LoginRequired from '$lib/components/authn/LoginRequired.svelte';
	import FlowMode from '$lib/components/market/FlowMode.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { authBusy } from '$lib/derived/user.derived';
	import { userStore } from '$lib/stores/user.store';
</script>

{#if $authBusy}
	<div
		class="flex min-h-[calc(100vh-10rem)] items-center justify-center"
		aria-label="Checking sign-in status"
		aria-live="polite"
		role="status"
	>
		<LoadingSpinner center={false} size="md" />
	</div>
{:else if isNullish($userStore.user)}
	<LoginRequired />
{:else}
	<FlowMode />
{/if}
