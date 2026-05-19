<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import SignInScreen from '$lib/components/authn/SignInScreen.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { userSignedIn } from '$lib/derived/user.derived';

	// If a returning user lands here while already authenticated,
	// route them straight to the app — keeps the back-button + share-
	// link semantics from the canonical phase router.
	$effect(() => {
		if ($userSignedIn) {
			void goto(AppPath.Home, { replaceState: true });
		}
	});

	onMount(() => {
		document.title = 'Sign in · VICI';
	});
</script>

<SignInScreen
	mode="signin"
	onSuccess={() => {
		void goto(AppPath.Home);
	}}
/>
