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
	import { checkNicknameAvailability, upsertProfile } from '$lib/services/profile.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { userStore } from '$lib/stores/user.store';
	import { t } from '$lib/utils/i18n.utils';

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

		// Returning user — the satellite already had a profile for this
		// principal at sign-in time. The pending onboarding (picked
		// pre-auth, while signed-out) belongs to a different intent;
		// silently overwriting their saved nickname / interests / email
		// is destructive. Preserve the existing profile and tell them.
		if ($userStore.profileExisted) {
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'onboarding.handoff.account_exists_title' }),
				message: t({
					locale: $localeStore,
					key: 'onboarding.handoff.account_exists',
					params: { nickname: $userStore.profile.nickname }
				}),
				type: 'info'
			});

			localStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY);

			return;
		}

		applyingPendingOnboarding = true;

		const currentProfile = $userStore.profile;
		const updated = {
			...currentProfile,
			nickname: pending.handle,
			interests: pending.interests,
			...(pending.email && { email: pending.email })
		};

		void (async () => {
			try {
				// Pre-flight: a brand-new user can still collide if
				// the handle was claimed in the window between
				// onboarding step 4 and sign-in landing. Probe first
				// so we can keep the pending payload around (so the
				// user has the chance to pick a new handle from their
				// profile) instead of letting the `setDoc` throw.
				const probe = await checkNicknameAvailability({
					nickname: pending.handle,
					principal: currentProfile.owner
				});

				if (!probe.available && probe.reason === 'taken') {
					notificationsStore.add({
						title: t({
							locale: $localeStore,
							key: 'onboarding.handoff.collision_title'
						}),
						message: t({
							locale: $localeStore,
							key: 'onboarding.handoff.collision',
							params: { handle: pending.handle }
						}),
						type: 'error'
					});

					// Apply interests + email even when the handle
					// collides — they're independently useful and
					// the user can rename later.
					await upsertProfile({
						key: currentProfile.owner,
						data: {
							...currentProfile,
							interests: pending.interests,
							...(pending.email && { email: pending.email })
						}
					});

					localStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY);

					return;
				}

				await upsertProfile({
					key: updated.owner,
					data: updated
				});

				userStore.update((curr) => ({ ...curr, profile: updated }));
				localStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY);
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : '';

				if (message.includes('already taken')) {
					notificationsStore.add({
						title: t({
							locale: $localeStore,
							key: 'onboarding.handoff.collision_title'
						}),
						message: t({
							locale: $localeStore,
							key: 'onboarding.handoff.collision',
							params: { handle: pending.handle }
						}),
						type: 'error'
					});
				} else {
					notificationsStore.add({
						title: t({ locale: $localeStore, key: 'onboarding.handoff.failed_title' }),
						message: t({ locale: $localeStore, key: 'onboarding.handoff.failed' }),
						type: 'error'
					});
				}

				localStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY);
			} finally {
				applyingPendingOnboarding = false;
			}
		})();
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
			aria-label={t({ locale: $localeStore, key: 'a11y.create_challenge' })}
			onclick={() => (challengeModalOpen = true)}
		>
			<Plus size={28} strokeWidth={2.5} />
		</button>
	{/if}

	<CreateChallengeModal isOpen={challengeModalOpen} onClose={() => (challengeModalOpen = false)} />

	<CompanionOverlay />
</div>
