<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import OnboardingFlow from '$lib/components/onboarding/OnboardingFlow.svelte';
	import { PENDING_ONBOARDING_STORAGE_KEY } from '$lib/constants/profile.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { featuredEvent } from '$lib/derived/featured-event.derived';
	import { userSignedIn } from '$lib/derived/user.derived';
	import { checkNicknameAvailability, upsertProfile } from '$lib/services/profile.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { userStore } from '$lib/stores/user.store';
	import { t } from '$lib/utils/i18n.utils';

	// Signed-in routing: a brand-new authenticated user who landed on
	// `/signup` (typically routed here by the (app) layout because their
	// profile has `onboardingCompleted: false`) goes through the same
	// 3-beat flow but with Beat 3's provider stack swapped for a Finish
	// button — they already have a session. A returning user is bounced into
	// the app (`AppPath.Flow`) — either because onboarding is already
	// complete, or because the satellite already held a profile at sign-in
	// (`profileExisted`), in which case a legacy `onboardingCompleted: false`
	// must not re-prompt.
	const authenticated = $derived(
		$userSignedIn &&
			$userStore.profile?.preferences?.onboardingCompleted !== true &&
			!$userStore.profileExisted
	);

	// Landing favourites deep-link in as `/signup?team=<ISO-2 code>`. The
	// code is a featured-event participant id, so map it straight to a
	// participant — but only forward it when it resolves to a current
	// participant. An absent or unknown `team` yields `undefined`, and
	// OnboardingFlow then opens on the normal team picker (no preselect).
	const initialParticipantId = $derived.by((): string | undefined => {
		const team = page.url.searchParams.get('team');

		if (team === null) {
			return;
		}

		// Normalize the deep-link param: participant ids are upper-case
		// ISO-3166 alpha-2, so trim + upper-case so `?team=br` (or with
		// stray whitespace) still resolves.
		const code = team.trim().toUpperCase();
		const match = $featuredEvent.participants.find((p) => p.id === code);

		return match?.id;
	});

	// Bounce any returning user back into the app: either onboarding is
	// already complete, or a profile existed at sign-in (a legacy account
	// whose `onboardingCompleted` defaults to `false` must not be re-prompted).
	$effect(() => {
		if (
			$userSignedIn &&
			($userStore.profile?.preferences?.onboardingCompleted === true || $userStore.profileExisted)
		) {
			void goto(resolve(AppPath.Flow), { replaceState: true });
		}
	});

	onMount(() => {
		document.title = 'Create account · VICI';
	});

	// Pre-auth completion (signed-out) — we persist the picks to
	// `PENDING_ONBOARDING_STORAGE_KEY` so the post-sign-in layout effect
	// can upsert them into the new profile. The auth tap itself happens
	// inside Beat 3 via `SignInProviderStack`; after it succeeds,
	// `$userSignedIn` flips and the (app) layout drains the payload.
	//
	// Reads any prior payload first so a `referralCode` stashed by
	// `/i/[code]` (the invite-link landing) survives this overwrite. The
	// drain in `(app)/+layout.svelte` picks the referral up regardless of
	// whether the user made any onboarding picks.
	const readExistingPending = (): Record<string, unknown> => {
		try {
			const raw = localStorage.getItem(PENDING_ONBOARDING_STORAGE_KEY);

			if (raw === null) {
				return {};
			}

			const parsed: unknown = JSON.parse(raw);

			return typeof parsed === 'object' && parsed !== null
				? (parsed as Record<string, unknown>)
				: {};
		} catch {
			return {};
		}
	};

	const handleCompletePreAuth = (result: {
		participantId: string | null;
		side: 'YES' | 'NO' | null;
		handle: string | null;
	}) => {
		if (!browser) {
			return;
		}

		const existing = readExistingPending();
		const existingReferralCode =
			typeof existing.referralCode === 'string' ? existing.referralCode : undefined;
		// An email stashed by the email provider (passkey-backed sign-up,
		// see `SignInProviderStack`) must survive this rebuild so the drain
		// persists it onto the profile.
		const existingEmail = typeof existing.email === 'string' ? existing.email : undefined;

		// Skip the write if the user bailed before making any pick **and** there's no
		// stashed referral code or email to carry forward — nothing to hand off.
		if (
			result.handle === null &&
			result.participantId === null &&
			result.side === null &&
			existingReferralCode === undefined &&
			existingEmail === undefined
		) {
			return;
		}

		try {
			localStorage.setItem(
				PENDING_ONBOARDING_STORAGE_KEY,
				JSON.stringify({
					handle: result.handle,
					participantId: result.participantId,
					side: result.side,
					interests: [],
					completedAt: new Date().toISOString(),
					...(existingReferralCode !== undefined && { referralCode: existingReferralCode }),
					...(existingEmail !== undefined && { email: existingEmail })
				})
			);
		} catch (err: unknown) {
			console.warn('Onboarding handoff could not be stored:', err);
		}
	};

	// Post-auth completion (already signed-in) — write the picks
	// directly to the profile and route into the app. We reuse the same
	// collision-aware pattern as `(app)/+layout.svelte`: probe nickname
	// availability first when a handle was picked; on collision, still
	// persist team/side/onboardingCompleted (those are independent of
	// the handle).
	let applyingAuthenticatedHandoff = $state(false);

	const handleCompleteAuthenticated = async (result: {
		participantId: string | null;
		side: 'YES' | 'NO' | null;
		handle: string | null;
	}) => {
		if (!browser || applyingAuthenticatedHandoff) {
			return;
		}

		const currentProfile = $userStore.profile;

		if (!currentProfile) {
			return;
		}

		applyingAuthenticatedHandoff = true;

		const sidePreference = result.side ?? '';
		const participantPreference = result.participantId ?? '';

		const baseUpdated = {
			...currentProfile,
			preferences: {
				...currentProfile.preferences,
				favoriteParticipantId: participantPreference,
				favoriteSide: sidePreference,
				onboardingCompleted: true
			}
		};

		try {
			let nextProfile = baseUpdated;

			if (result.handle !== null) {
				const probe = await checkNicknameAvailability({
					nickname: result.handle,
					principal: currentProfile.owner
				});

				if (!probe.available) {
					// Any unavailable reason — `'taken'`, or the `'too_short'` /
					// `'required'` cases that a tolerated legacy payload can still
					// produce — must SKIP the nickname update. Keeping the
					// bootstrapped nickname lets the upsert below persist
					// team/side/completion (the picks that matter), instead of the
					// satellite rejecting the whole atomic write. Only the
					// collision case is worth a toast; the user can rename later.
					if (probe.reason === 'taken') {
						notificationsStore.add({
							title: t({
								locale: $localeStore,
								key: 'onboarding.handoff.collision_title'
							}),
							message: t({
								locale: $localeStore,
								key: 'onboarding.handoff.collision',
								params: { handle: result.handle }
							}),
							type: 'error'
						});
					}
				} else {
					// Stamp the handle-change time so the set-profile assertion
					// accepts the write. The satellite requires `handleLastChangeMs`
					// ≈ now whenever the (normalized) nickname differs from the
					// stored doc, and rejects a moved stamp when it is unchanged —
					// so stamp only on a real change. A brand-new user's
					// bootstrapped nickname (their OAuth display name / shortened
					// principal) almost always differs from the handle they pick,
					// which is exactly the case that was failing.
					const handleChanged =
						result.handle.trim().toLowerCase() !==
						(currentProfile.nickname ?? '').trim().toLowerCase();

					nextProfile = {
						...baseUpdated,
						nickname: result.handle,
						...(handleChanged && { handleLastChangeMs: Date.now() })
					};
				}
			}

			await upsertProfile({
				key: nextProfile.owner,
				data: nextProfile
			});

			// Bake the new profile into the store so the (app) layout's
			// redirect effect sees `onboardingCompleted: true` immediately
			// and doesn't bounce us back to /signup.
			userStore.update((curr) => ({ ...curr, profile: nextProfile }));

			void goto(resolve(AppPath.Flow), { replaceState: true });
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : '';

			// Surface the real failure — the generic toast below otherwise
			// swallows it, which is what made this class of bug invisible.
			console.error('Onboarding handoff (authenticated) failed:', err);

			if (message.includes('already taken')) {
				notificationsStore.add({
					title: t({
						locale: $localeStore,
						key: 'onboarding.handoff.collision_title'
					}),
					message: t({
						locale: $localeStore,
						key: 'onboarding.handoff.collision',
						params: { handle: result.handle ?? '' }
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
		} finally {
			applyingAuthenticatedHandoff = false;
		}
	};

	const handleComplete = (result: {
		participantId: string | null;
		side: 'YES' | 'NO' | null;
		handle: string | null;
	}) => {
		if (authenticated) {
			void handleCompleteAuthenticated(result);

			return;
		}

		handleCompletePreAuth(result);
	};
</script>

<OnboardingFlow {authenticated} {initialParticipantId} onComplete={handleComplete} />
