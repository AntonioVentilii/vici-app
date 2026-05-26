<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Header from '$lib/components/layout/Header.svelte';
	import MobileNav from '$lib/components/layout/MobileNav.svelte';
	import Loaders from '$lib/components/loaders/Loaders.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import CompanionOverlay from '$lib/components/ui/CompanionOverlay.svelte';
	import { PENDING_ONBOARDING_STORAGE_KEY } from '$lib/constants/profile.constants';
	import {
		REFERRAL_CODE_REGEX,
		REFERRAL_VXP_BONUS_BASE_UNITS
	} from '$lib/constants/referral.constants';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import { userSignedIn, userSignedOutResolved } from '$lib/derived/user.derived';
	import { checkNicknameAvailability, upsertProfile } from '$lib/services/profile.services';
	import { redeemReferralCode } from '$lib/services/referral.services';
	import { initFlowPrewarm } from '$lib/stores/flow.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { userStore } from '$lib/stores/user.store';
	import { t } from '$lib/utils/i18n.utils';
	import { formatVxpBalance } from '$lib/utils/playground-display.utils';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();

	// Pre-warm the Flow deck so opening `/flow` is instantaneous.
	// Subscriptions inside re-warm in the background on sign-in,
	// balance-domain switch, featured-event toggle, or interest
	// edits — components never block on the rebuild.
	onMount(() => initFlowPrewarm());

	const isFlowPage = $derived(page.url.pathname === AppPath.Flow);

	// Market detail (`/markets/[id]`) is rendered as a single linear
	// mobile-first surface with its own sticky bottom CTA bar — the
	// global mobile tab bar is hidden on this route so the CTA owns the
	// bottom slot, and the container padding is dropped so the hero +
	// chart cards can run edge-to-edge the way the prototype does. The
	// `'/markets/'` prefix already excludes the bare listing route at
	// `/markets`, so no extra guard is needed.
	const isMarketDetailPage = $derived(page.url.pathname.startsWith('/markets/'));

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
	): { handle: string; interests: string[]; email?: string; referralCode?: string } | undefined => {
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
		const rawReferral =
			'referralCode' in parsed && typeof parsed.referralCode === 'string'
				? parsed.referralCode.toUpperCase().trim()
				: undefined;
		const referralCode =
			rawReferral && REFERRAL_CODE_REGEX.test(rawReferral) ? rawReferral : undefined;

		return {
			handle: parsed.handle,
			interests,
			email,
			referralCode
		};
	};

	/**
	 * Best-effort post-signin redemption of the pre-auth referral code. Errors are surfaced as
	 * toasts (with the satellite-thrown reason when available) but never bounce the user out of
	 * the app — we've already accepted the profile by the time this fires, and the referral is
	 * cosmetic relative to the rest of onboarding.
	 */
	const redeemPendingReferralIfAny = async (code: string | undefined): Promise<void> => {
		if (!code) {
			return;
		}

		try {
			await redeemReferralCode({ code });

			notificationsStore.add({
				title: t({
					locale: $localeStore,
					key: 'onboarding.handoff.referral_ok_title'
				}),
				message: t({
					locale: $localeStore,
					key: 'onboarding.handoff.referral_ok',
					params: { amount: formatVxpBalance({ value: REFERRAL_VXP_BONUS_BASE_UNITS }) }
				}),
				type: 'success'
			});
		} catch (err: unknown) {
			const reason = err instanceof Error ? err.message : '';

			notificationsStore.add({
				title: t({
					locale: $localeStore,
					key: 'onboarding.handoff.referral_failed_title'
				}),
				message: t({
					locale: $localeStore,
					key: 'onboarding.handoff.referral_failed',
					params: { reason: reason || code }
				}),
				type: 'error'
			});
		}
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

					// Handle collision is independent of the referral redemption — the user is still a
					// new sign-up and deserves the bonus.
					void redeemPendingReferralIfAny(pending.referralCode);

					return;
				}

				await upsertProfile({
					key: updated.owner,
					data: updated
				});

				userStore.update((curr) => ({ ...curr, profile: updated }));
				localStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY);

				// Redeem after the profile is in place so the satellite assertion (which requires an
				// existing profile) passes. Fire-and-forget — the toast inside handles success and
				// failure, and we don't want to keep the loading state open for the ledger transfer.
				void redeemPendingReferralIfAny(pending.referralCode);
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

	<main class="flex-1 {isFlowPage || isMarketDetailPage ? 'md:pb-0' : 'pb-20 md:pb-0'}">
		{#key page.url.pathname}
			<div
				class={isFlowPage
					? 'md:container md:mx-auto md:px-4 md:py-8'
					: isMarketDetailPage
						? 'mx-auto w-full max-w-[36rem] md:container md:px-4 md:py-8'
						: 'container mx-auto px-4 py-4 md:py-8'}
				data-tid={TestId.AppMain}
				in:fade={{ duration: 100, delay: 100 }}
				out:fade={{ duration: 100 }}
			>
				{@render children()}
			</div>
		{/key}

		<Loaders />
	</main>

	<!--
		Bottom nav is visible on every signed-in surface including Flow,
		matching the prototype's BottomNav. Market detail (`/markets/[id]`)
		is the one exception — it owns the bottom slot with its own
		sticky YES/NO CTA bar so the tab bar is suppressed there.
	-->
	{#if !isMarketDetailPage}
		<MobileNav />
	{/if}

	<CompanionOverlay />
</div>
