<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import LoginRequired from '$lib/components/authn/LoginRequired.svelte';
	import FlowMode from '$lib/components/market/FlowMode.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { guestMode } from '$lib/derived/guest.derived';
	import { authBusy } from '$lib/derived/user.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import { t } from '$lib/utils/i18n.utils';
</script>

{#if $authBusy}
	<div
		class="flex min-h-[calc(100vh-10rem)] items-center justify-center"
		aria-label={t({ locale: $localeStore, key: 'a11y.checking_signin' })}
		aria-live="polite"
		role="status"
	>
		<LoadingSpinner size="md" />
	</div>
{:else if isNullish($userStore.user) && !$guestMode}
	<LoginRequired />
{:else}
	<FlowMode />
{/if}
