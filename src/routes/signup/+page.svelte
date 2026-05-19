<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import SignInScreen from '$lib/components/authn/SignInScreen.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { userSignedIn } from '$lib/derived/user.derived';

	// Returning user with a live session — route to app, don't re-do
	// the create-account flow.
	$effect(() => {
		if ($userSignedIn) {
			void goto(AppPath.Home, { replaceState: true });
		}
	});

	onMount(() => {
		document.title = 'Create account · VICI';
	});
</script>

<!--
  Phase 1: this route mirrors the sign-in shell with a "create account"
  framing. The pre-sign-in 4-step onboarding flow (live first swipe,
  gestures, categories, handle) lands in Phase 2 and replaces the
  contents of this page. See `docs/ai/frontend/design.md` §8.2.
-->
<SignInScreen
	mode="signup"
	onSuccess={() => {
		void goto(AppPath.Home);
	}}
/>
