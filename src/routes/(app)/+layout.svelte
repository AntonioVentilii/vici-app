<script lang="ts">
	import { Plus } from 'lucide-svelte/icons';
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Authn from '$lib/components/authn/Authn.svelte';
	import CreateChallengeModal from '$lib/components/challenge/CreateChallengeModal.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import MobileNav from '$lib/components/layout/MobileNav.svelte';
	import Loaders from '$lib/components/loaders/Loaders.svelte';
	import OnboardingFlow from '$lib/components/onboarding/OnboardingFlow.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import CompanionOverlay from '$lib/components/ui/CompanionOverlay.svelte';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import { userSignedIn, userSignedOutResolved } from '$lib/derived/user.derived';
	import { upsertProfile } from '$lib/services/profile.services';
	import { userStore } from '$lib/stores/user.store';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();

	const isFlowPage = $derived(page.url.pathname === AppPath.Flow);

	let challengeModalOpen = $state(false);
	let onboardingDismissed = $state(false);

	// Auth gate — every (app) route requires a session. We only
	// redirect once `userSignedOutResolved` is true, i.e. after the
	// initial auth handshake has completed. Reacting to `authBusy`
	// directly would bounce users to /signin during a normal page
	// load. See `docs/ai/frontend/design.md` §8.1.
	$effect(() => {
		if (!browser) {
			return;
		}

		if ($userSignedOutResolved) {
			void goto(PublicPath.SignIn, { replaceState: true });
		}
	});

	const needsOnboarding = $derived(
		$userSignedIn && !onboardingDismissed && !$userStore.profile?.archetype
	);

	const handleOnboardingComplete = async (result: {
		handle: string;
		archetype: string;
		interests: string[];
	}) => {
		const { profile } = $userStore;

		if (!profile) {
			return;
		}

		const updated = {
			...profile,
			nickname: result.handle,
			archetype: result.archetype,
			interests: result.interests
		};

		await upsertProfile({
			key: profile.owner,
			data: updated
		});

		userStore.update((curr) => ({ ...curr, profile: updated }));
		onboardingDismissed = true;
	};
</script>

<div class="relative isolate flex min-h-dvh flex-col">
	<div class={isFlowPage ? 'hidden md:block' : ''}>
		<Banner />
	</div>

	<div class={isFlowPage ? 'hidden md:block' : ''}>
		<Header />
	</div>

	<main class="flex-1 {isFlowPage ? 'md:pb-0' : 'pb-20 md:pb-0'}">
		<Authn>
			{#key page.url.pathname}
				<div
					class={isFlowPage
						? 'md:container md:mx-auto md:px-4 md:py-8'
						: 'container mx-auto px-4 py-8'}
					data-tid={TestId.AppMain}
					in:fade={{ duration: 100, delay: 100 }}
					out:fade={{ duration: 100 }}
				>
					{@render children()}
				</div>
			{/key}

			<Loaders />
		</Authn>
	</main>

	<div class={isFlowPage ? 'hidden md:block' : ''}>
		<Footer />
	</div>

	{#if !isFlowPage}
		<MobileNav />
	{/if}

	{#if $userSignedIn && !isFlowPage}
		<button
			class="bg-primary text-primary-foreground fixed right-6 bottom-24 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_24px_-8px_var(--laurel-glow)] transition-all hover:scale-105 active:scale-[0.985] md:bottom-8"
			aria-label="Create Challenge"
			onclick={() => (challengeModalOpen = true)}
		>
			<Plus size={28} strokeWidth={2.5} />
		</button>
	{/if}

	<CreateChallengeModal isOpen={challengeModalOpen} onClose={() => (challengeModalOpen = false)} />

	<CompanionOverlay />

	{#if needsOnboarding}
		<OnboardingFlow onComplete={handleOnboardingComplete} />
	{/if}
</div>
