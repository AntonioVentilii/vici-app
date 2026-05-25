<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import OnboardingFlow from '$lib/components/onboarding/OnboardingFlow.svelte';
	import { PENDING_ONBOARDING_STORAGE_KEY } from '$lib/constants/profile.constants';
	import { REFERRAL_CODE_LENGTH, REFERRAL_CODE_REGEX } from '$lib/constants/referral.constants';
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

	// Deep-link prefill: `?ref=CODE` lands here from a referrer's share. We sanitise the value to
	// match {@link REFERRAL_CODE_REGEX} before passing it through, so an attacker can't seed
	// random characters into the onboarding form via the URL bar.
	const sanitiseRef = (raw: string): string | undefined => {
		const normalised = raw
			.toUpperCase()
			.replace(/[^0-9A-Z]/g, '')
			.slice(0, REFERRAL_CODE_LENGTH);

		return REFERRAL_CODE_REGEX.test(normalised) ? normalised : undefined;
	};

	const initialReferralCode = $derived(
		(() => {
			const raw = page.url.searchParams.get('ref');

			return raw ? sanitiseRef(raw) : undefined;
		})()
	);

	const handleComplete = (result: {
		handle: string;
		interests: string[];
		email?: string;
		referralCode?: string;
	}) => {
		if (browser) {
			try {
				localStorage.setItem(
					PENDING_ONBOARDING_STORAGE_KEY,
					JSON.stringify({ ...result, completedAt: new Date().toISOString() })
				);
			} catch (err: unknown) {
				console.warn('Onboarding handoff could not be stored:', err);
			}
		}

		void goto(resolve('/signin'));
	};
</script>

<OnboardingFlow
	{initialReferralCode}
	onComplete={handleComplete}
	onSignIn={() => {
		void goto(resolve('/signin'));
	}}
/>
