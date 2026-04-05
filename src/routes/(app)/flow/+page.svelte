<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import LoginRequired from '$lib/components/authn/LoginRequired.svelte';
	import FlowMode from '$lib/components/market/FlowMode.svelte';
	import { userStore } from '$lib/stores/user.store';
</script>

{#if isNullish($userStore.user)}
	<LoginRequired />
{:else}
	<FlowMode />
{/if}
