<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import OnboardingFlow from '$lib/components/onboarding/OnboardingFlow.svelte';
	import { PENDING_ONBOARDING_STORAGE_KEY } from '$lib/constants/profile.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { userSignedIn } from '$lib/derived/user.derived';

	$effect(() => {
		if ($userSignedIn) {
			void goto(resolve(AppPath.Home), { replaceState: true });
		}
	});

	onMount(() => {
		document.title = 'Create account · VICI';
	});

	// Onboarding completes pre-auth — we persist the user's picks
	// (handle is the only one the layout currently knows how to
	// apply; interests / email aren't picked in the 3-beat flow) to
	// `PENDING_ONBOARDING_STORAGE_KEY` so the
	// post-sign-in layout effect can upsert the new profile with
	// them. The auth tap itself happens inside Beat 3 via
	// `SignInActions`; after it succeeds, `$userSignedIn` flips and
	// the top-level effect above redirects to Home.
	const handleComplete = (result: {
		participantId: string | null;
		side: 'YES' | 'NO' | null;
		handle: string | null;
	}) => {
		if (!browser || result.handle === null) {
			return;
		}

		try {
			localStorage.setItem(
				PENDING_ONBOARDING_STORAGE_KEY,
				JSON.stringify({
					handle: result.handle,
					interests: [],
					completedAt: new Date().toISOString()
				})
			);
		} catch (err: unknown) {
			console.warn('Onboarding handoff could not be stored:', err);
		}
	};
</script>

<OnboardingFlow onComplete={handleComplete} />
