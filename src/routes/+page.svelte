<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import WelcomePage from '$lib/components/pages/WelcomePage.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { userSignedIn, userSignedOutResolved } from '$lib/derived/user.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	// Root landing gate.
	//
	// - Signed-in cold loads are short-circuited by the inline `<head>`
	//   script in `app.html` (reads the `vici.signed-in` localStorage
	//   flag) so no UI paints before the bounce.
	// - For warm in-app navigations to `/`, this $effect bounces to
	//   `/flow` once `userSignedIn` resolves — Flow mode is the
	//   canonical first surface for every authenticated session.
	// - For signed-out visitors, we render `WelcomePage` only once the
	//   auth handshake has settled, leaving the brand-coloured shell
	//   blank in the brief unresolved window. This guarantees the
	//   marketing surface never flashes for a signed-in user that the
	//   inline script missed (private mode, cleared storage, etc.).
	$effect(() => {
		if ($userSignedIn) {
			void goto(resolve(AppPath.Flow), { replaceState: true });
		}
	});
</script>

<svelte:head>
	<title>{t({ locale: $localeStore, key: 'seo.home.title' })}</title>
	<meta name="description" content={t({ locale: $localeStore, key: 'seo.home.description' })} />
</svelte:head>

{#if $userSignedOutResolved}
	<WelcomePage />
{:else}
	<div class="bg-background min-h-dvh"></div>
{/if}
