<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import SignInScreen from '$lib/components/authn/SignInScreen.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { userSignedIn } from '$lib/derived/user.derived';

	// If a returning user lands here while already authenticated,
	// route them straight to the app. Single source of truth — the
	// reactive `$effect` covers both the cold-load-already-signed-in
	// case AND the post-signIn() success bounce. Avoid duplicating the
	// trigger on `<SignInScreen onSuccess>` since the two callbacks
	// could fire concurrently and cause a brief signin-flash before
	// `userStore` has finished hydrating the new principal.
	$effect(() => {
		if ($userSignedIn) {
			void goto(AppPath.Home, { replaceState: true });
		}
	});

	onMount(() => {
		document.title = 'Sign in · VICI';
	});
</script>

<SignInScreen mode="signin" />
