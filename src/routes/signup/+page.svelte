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

	const handleComplete = (result: { handle: string; interests: string[]; email?: string }) => {
		if (browser) {
			try {
				localStorage.setItem(
					PENDING_ONBOARDING_STORAGE_KEY,
					JSON.stringify({ ...result, completedAt: new Date().toISOString() })
				);
			} catch (err) {
				console.warn('Onboarding handoff could not be stored:', err);
			}
		}

		void goto(resolve('/signin'));
	};
</script>

<OnboardingFlow
	onComplete={handleComplete}
	onSignIn={() => {
		void goto(resolve('/signin'));
	}}
/>
