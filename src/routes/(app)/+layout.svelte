<script lang="ts">
	import { Plus } from 'lucide-svelte/icons';
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Authn from '$lib/components/authn/Authn.svelte';
	import CreateChallengeModal from '$lib/components/challenge/CreateChallengeModal.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import MobileNav from '$lib/components/layout/MobileNav.svelte';
	import Loaders from '$lib/components/loaders/Loaders.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import CompanionOverlay from '$lib/components/ui/CompanionOverlay.svelte';
	import { PENDING_ONBOARDING_STORAGE_KEY } from '$lib/constants/profile.constants';
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
	let applyingPendingOnboarding = $state(false);

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
			void goto(resolve(PublicPath.SignIn), { replaceState: true });
		}
	});

	const parsePendingOnboarding = (
		raw: string
	): { handle: string; interests: string[]; email?: string } | undefined => {
		let parsed: unknown;

		try {
			parsed = JSON.parse(raw);
		} catch {
			parsed = null;
		}

		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			!('handle' in parsed) ||
			typeof parsed.handle !== 'string'
		) {
			return;
		}

		const interests =
			'interests' in parsed && Array.isArray(parsed.interests)
				? parsed.interests.filter((interest): interest is string => typeof interest === 'string')
				: [];
		const email =
			'email' in parsed && typeof parsed.email === 'string' && parsed.email.trim().length > 0
				? parsed.email.trim()
				: undefined;

		return {
			handle: parsed.handle,
			interests,
			email
		};
	};

	$effect(() => {
		if (!browser || applyingPendingOnboarding || !$userSignedIn || !$userStore.profile) {
			return;
		}

		const raw = localStorage.getItem(PENDING_ONBOARDING_STORAGE_KEY);

		if (!raw) {
			return;
		}

		const pending = parsePendingOnboarding(raw);

		if (!pending) {
			localStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY);

			return;
		}

		applyingPendingOnboarding = true;

		const updated = {
			...$userStore.profile,
			nickname: pending.handle,
			interests: pending.interests,
			...(pending.email && { email: pending.email })
		};

		void upsertProfile({
			key: updated.owner,
			data: updated
		})
			.then(() => {
				userStore.update((curr) => ({ ...curr, profile: updated }));
				localStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY);
			})
			.catch((err: unknown) => {
				console.warn('Pending onboarding handoff failed:', err);
				localStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY);
			})
			.finally(() => {
				applyingPendingOnboarding = false;
			});
	});
</script>

<div class="relative isolate flex min-h-dvh flex-col">
	<div class="hidden md:block">
		<Banner />
	</div>

	<div class="hidden md:block">
		<Header />
	</div>

	<main class="flex-1 {isFlowPage ? 'md:pb-0' : 'pb-20 md:pb-0'}">
		<Authn>
			{#key page.url.pathname}
				<div
					class={isFlowPage
						? 'md:container md:mx-auto md:px-4 md:py-8'
						: 'container mx-auto px-4 py-4 md:py-8'}
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

	<div class="hidden md:block">
		<Footer />
	</div>

	{#if !isFlowPage}
		<MobileNav />
	{/if}

	{#if $userSignedIn && !isFlowPage}
		<button
			class="bg-primary text-primary-foreground fixed right-6 bottom-24 z-40 hidden h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_24px_-8px_var(--laurel-glow)] transition-all hover:scale-105 active:scale-[0.985] md:bottom-8 md:flex"
			aria-label="Create Challenge"
			onclick={() => (challengeModalOpen = true)}
		>
			<Plus size={28} strokeWidth={2.5} />
		</button>
	{/if}

	<CreateChallengeModal isOpen={challengeModalOpen} onClose={() => (challengeModalOpen = false)} />

	<CompanionOverlay />
</div>
