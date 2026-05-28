<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import DesktopAppNav from '$lib/components/layout/DesktopAppNav.svelte';
	import MobileNav from '$lib/components/layout/MobileNav.svelte';
	import Loaders from '$lib/components/loaders/Loaders.svelte';
	import CompanionOverlay from '$lib/components/ui/CompanionOverlay.svelte';
	import { PENDING_ONBOARDING_STORAGE_KEY } from '$lib/constants/profile.constants';
	import {
		REFERRAL_CODE_REGEX,
		REFERRAL_EXISTING_USER_REASON,
		REFERRAL_VXP_BONUS_BASE_UNITS
	} from '$lib/constants/referral.constants';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import { userSignedIn, userSignedOutResolved } from '$lib/derived/user.derived';
	import { checkNicknameAvailability, upsertProfile } from '$lib/services/profile.services';
	import { claimReferralFriendship, redeemReferralCode } from '$lib/services/referral.services';
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
	//
	// Gated on `$userSignedIn` so anonymous visitors on the public
	// `/markets` browse surface don't kick off Flow's tag / metadata /
	// queue fetches. `initFlowPrewarm` is idempotent (guarded by an
	// internal `initialized` flag) so re-firing on the signed-out →
	// signed-in transition is a no-op past the first call.
	$effect(() => {
		if ($userSignedIn) {
			initFlowPrewarm();
		}
	});

	// Viewport architecture: inside the authenticated `(app)` shell
	// the document doesn't scroll. We tag <html> with `data-app="1"`
	// so `app.css` can lock `html`/`body` height + `body { overflow:
	// hidden }` only for these routes. The scroll viewport is the
	// `.screen-scroll` `<main>` below. Marketing routes (`/`, `/about`,
	// `/welcome`, `/signin`, `/signup`, `/info/*`) live outside this
	// layout and keep natural body scroll.
	onMount(() => {
		document.documentElement.dataset.app = '1';

		return () => {
			delete document.documentElement.dataset.app;
		};
	});

	// Market detail (`/markets/[id]`) is rendered as a single linear
	// mobile-first surface with its own sticky bottom CTA bar — the
	// global mobile tab bar is hidden on this route so the CTA owns
	// the bottom slot, and the container padding is dropped so the
	// hero + chart cards can run edge-to-edge. The `'/markets/'`
	// prefix already excludes the bare listing route at `/markets`,
	// so no extra guard is needed.
	const isMarketDetailPage = $derived(page.url.pathname.startsWith('/markets/'));

	// Public markets surface — any visitor can browse the list and
	// open a market's detail before signing up. The market list
	// (`/markets`) and the detail (`/markets/[id]`) are exempted from
	// the auth gate below; auth-requiring affordances on those pages
	// (placing a call, saving, resolving) bounce to `/signin` at the
	// point of action.
	const isPublicMarketsRoute = $derived(
		page.url.pathname === '/markets' || page.url.pathname.startsWith('/markets/')
	);

	// Info / legal docs (`/info/[slug]`) sit inside the (app) shell so
	// signed-in users get the navpill while reading them, but they
	// must also stay reachable from pre-auth surfaces (the signup
	// terms / privacy links in `OnboardingBeat3`). Treat them as a
	// public route alongside the markets exemption above.
	const isPublicInfoRoute = $derived(page.url.pathname.startsWith('/info/'));

	let applyingPendingOnboarding = $state(false);

	// Auth gate — every (app) route requires a session. We only
	// redirect once `userSignedOutResolved` is true, i.e. after the
	// initial auth handshake has completed. Reacting to `authBusy`
	// directly would bounce users to /signin during a normal page
	// load. See `docs/ai/frontend/design.md` §8.1.
	//
	// Belt-and-braces: also require `!$userSignedIn` so a transient
	// `authBusy` flip during a hot in-app navigation (e.g. just after
	// `signIn()` resolves but before the userStore has finished
	// hydrating the new principal's profile) doesn't briefly bounce a
	// signed-in user back to /signin — the visible "double sign-in"
	// flash the user reported on 2026-05-27.
	$effect(() => {
		if (!browser) {
			return;
		}

		if (isPublicMarketsRoute || isPublicInfoRoute) {
			return;
		}

		if ($userSignedOutResolved && !$userSignedIn) {
			void goto(resolve(PublicPath.SignIn), { replaceState: true });
		}
	});

	const parsePendingOnboarding = (
		raw: string
	):
		| {
				handle: string | null;
				participantId: string | null;
				side: 'YES' | 'NO' | null;
				interests: string[];
				email?: string;
				referralCode?: string;
		  }
		| undefined => {
		let parsed: unknown;

		try {
			parsed = JSON.parse(raw);
		} catch {
			parsed = null;
		}

		if (typeof parsed !== 'object' || parsed === null) {
			return;
		}

		// Tolerate legacy payloads — older clients wrote `handle` as the
		// only required field. New clients also serialize team + side, but
		// any combination of {handle, participantId, side} may be null.
		const handle =
			'handle' in parsed && typeof parsed.handle === 'string' && parsed.handle.length > 0
				? parsed.handle
				: null;
		const participantId =
			'participantId' in parsed &&
			typeof parsed.participantId === 'string' &&
			parsed.participantId.length > 0
				? parsed.participantId
				: null;
		const rawSide = 'side' in parsed && typeof parsed.side === 'string' ? parsed.side : null;
		const side: 'YES' | 'NO' | null = rawSide === 'YES' || rawSide === 'NO' ? rawSide : null;

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

		// At least one actionable signal is required for the payload to be useful — onboarding
		// picks (handle / participantId / side) drive the profile upsert, and `referralCode`
		// drives the redeem-or-friendship flow. A bare payload with none of those is dropped
		// so the caller can clear the slot.
		if (handle === null && participantId === null && side === null && referralCode === undefined) {
			return;
		}

		return {
			handle,
			participantId,
			side,
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

			// Signup-window grace period elapsed (clicked the invite, took >24h to finish
			// signing up). The VXP bonus is forfeited, but we still want the friendship to
			// land — otherwise the click attribution was wasted. Fire-and-forget; the
			// satellite is idempotent if a relation already exists.
			if (reason === REFERRAL_EXISTING_USER_REASON) {
				try {
					await claimReferralFriendship({ code });

					notificationsStore.add({
						title: t({
							locale: $localeStore,
							key: 'onboarding.handoff.referral_late_title'
						}),
						message: t({
							locale: $localeStore,
							key: 'onboarding.handoff.referral_late'
						}),
						type: 'info'
					});
				} catch (friendErr: unknown) {
					// Swallow — we surfaced the late-redemption fallback intent; the
					// friendship is best-effort.
					console.warn(
						'claimReferralFriendship fallback failed',
						friendErr instanceof Error ? friendErr.message : friendErr
					);
				}

				return;
			}

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
		//
		// A stashed `referralCode` is the one piece of the payload that
		// *is* still actionable for a returning user: they can't redeem
		// the VXP bonus (they're not a fresh signup), but they can still
		// land in the inviter's friends list. Fire `claimReferralFriendship`
		// before clearing the payload — fire-and-forget so a transient
		// failure never blocks the account-exists message.
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

			if (pending.referralCode !== undefined) {
				const friendshipCode = pending.referralCode;

				void (async () => {
					try {
						await claimReferralFriendship({ code: friendshipCode });

						notificationsStore.add({
							title: t({
								locale: $localeStore,
								key: 'onboarding.handoff.referral_late_title'
							}),
							message: t({
								locale: $localeStore,
								key: 'onboarding.handoff.referral_late'
							}),
							type: 'info'
						});
					} catch (err: unknown) {
						console.warn(
							'claimReferralFriendship (returning user) failed',
							err instanceof Error ? err.message : err
						);
					}
				})();
			}

			localStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY);

			return;
		}

		applyingPendingOnboarding = true;

		const currentProfile = $userStore.profile;

		// Onboarding picks live under `preferences`. Always apply
		// team/side/onboardingCompleted on the new-user path — the user
		// just finished the 3-beat flow, so completion is recorded even
		// when they skipped the picks. Preserve everything else under
		// `preferences` so the seed defaults stay intact.
		const sidePreference = pending.side ?? '';
		const participantPreference = pending.participantId ?? '';
		const baseUpdated = {
			...currentProfile,
			interests: pending.interests,
			...(pending.email && { email: pending.email }),
			preferences: {
				...currentProfile.preferences,
				favoriteParticipantId: participantPreference,
				favoriteSide: sidePreference,
				onboardingCompleted: true
			}
		};

		void (async () => {
			try {
				let nextProfile = baseUpdated;

				if (pending.handle !== null) {
					// Pre-flight: a brand-new user can still collide if
					// the handle was claimed in the window between
					// onboarding step 4 and sign-in landing. Probe first
					// so we can keep team/side/onboardingCompleted (which
					// are independent of the handle) and let the user
					// rename later from their profile.
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

						// Apply interests + email + team/side/completion
						// even when the handle collides — they're
						// independently useful and the user can rename
						// later.
						await upsertProfile({
							key: currentProfile.owner,
							data: baseUpdated
						});

						userStore.update((curr) => ({ ...curr, profile: baseUpdated }));
						localStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY);

						// Handle collision is independent of the referral redemption — the user is still a
						// new sign-up and deserves the bonus.
						void redeemPendingReferralIfAny(pending.referralCode);

						return;
					}

					nextProfile = { ...baseUpdated, nickname: pending.handle };
				}

				await upsertProfile({
					key: nextProfile.owner,
					data: nextProfile
				});

				userStore.update((curr) => ({ ...curr, profile: nextProfile }));
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
							params: { handle: pending.handle ?? '' }
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

	// Brand-new signed-in users who skipped `/signup` (signed in via
	// `/signin` or via the auth landing flow) end up with a fresh
	// profile whose `preferences.onboardingCompleted === false`. Route
	// them to the 3-beat onboarding (which renders in authenticated mode
	// — Beat 3 swaps the provider stack for a Finish button). We gate on
	// `!profileExisted` so returning users whose legacy profiles default
	// `onboardingCompleted` to `false` are NOT re-prompted; their
	// existing satellite-side profile wins.
	$effect(() => {
		if (
			!browser ||
			applyingPendingOnboarding ||
			!$userSignedIn ||
			!$userStore.profile ||
			$userStore.profileExisted
		) {
			return;
		}

		if ($userStore.profile.preferences?.onboardingCompleted === true) {
			return;
		}

		if (page.url.pathname === PublicPath.SignUp) {
			return;
		}

		// If a pending payload is still being applied in the same tick,
		// let that path finish — it will set `onboardingCompleted: true`.
		const raw = localStorage.getItem(PENDING_ONBOARDING_STORAGE_KEY);

		if (raw !== null) {
			return;
		}

		void goto(resolve(PublicPath.SignUp), { replaceState: true });
	});
</script>

<div class="relative isolate flex h-full flex-col">
	<!--
		Desktop chrome — landing-style top nav. Hidden at <56rem; the
		mobile floating pillnav (rendered below as `<MobileNav>`) owns
		the chrome at narrower viewports.

		The desktop layout adapts the mobile design to a proper
		desktop chrome: top-nav header + wider content column, NOT
		a fake-mobile phone bezel.
	-->
	<DesktopAppNav />

	<main class="screen-scroll">
		{#key page.url.pathname}
			<div
				class="app-shell-content"
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
		Bottom nav is visible on every signed-in surface including
		Flow. Two exceptions:
		- Anonymous visitors on public routes (`/markets`, `/markets/*`,
		  `/info/*`) — the navpill's tabs all point at auth-gated areas,
		  so showing it to a signed-out user is a dead-end.
		- Market detail (`/markets/[id]`) — owns the bottom slot with
		  its own sticky YES/NO CTA bar.
	-->
	{#if $userSignedIn && !isMarketDetailPage}
		<MobileNav />
	{/if}

	<CompanionOverlay />
</div>
