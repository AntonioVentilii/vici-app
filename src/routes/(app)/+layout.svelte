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
	import AccountReturnGate from '$lib/components/settings/AccountReturnGate.svelte';
	import CompanionOverlay from '$lib/components/ui/CompanionOverlay.svelte';
	import NotifToastHost from '$lib/components/ui/NotifToastHost.svelte';
	import { PENDING_ONBOARDING_STORAGE_KEY } from '$lib/constants/profile.constants';
	import {
		REFERRAL_CODE_REGEX,
		REFERRAL_EXISTING_USER_REASON,
		REFERRAL_VXP_BONUS_BASE_UNITS
	} from '$lib/constants/referral.constants';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import { userSignedIn, userSignedOutResolved } from '$lib/derived/user.derived';
	import { joinLeagueByInvite } from '$lib/services/leagues.services';
	import { checkNicknameAvailability, upsertProfile } from '$lib/services/profile.services';
	import { claimReferralFriendship, redeemReferralCode } from '$lib/services/referral.services';
	import { initFlowPrewarm } from '$lib/stores/flow.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { userStore } from '$lib/stores/user.store';
	import { LEAGUE_INVITE_CODE_REGEX } from '$lib/types/league';
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

	// Public markets surface — any visitor can open a market's detail
	// (`/markets/[id]`) before signing up. Auth-requiring affordances on
	// the detail page (placing a call, saving, resolving) bounce to
	// `/signin` at the point of action. The bare `/markets` path is now a
	// redirect alias to the canonical list (`/app`); the path stays
	// exempt so the redirect page mounts and forwards without a transient
	// signin bounce, then the auth-gated `/app` destination owns the
	// signed-out path.
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

	// Share-link referral attribution. The prediction-share sheet hands out
	// `/m/{id}?ref={code}` (aliased to `/markets/{id}?ref={code}`, which lands
	// inside this layout). Reading the param here — the first place a freshly
	// arriving visitor is handled — lets us credit the referral without a
	// dedicated landing route: we stash the code into the SAME
	// `vici:pending-onboarding` slot that `/i/{code}` uses, and the drain below
	// redeems it post-signin (or, for a returning user, falls back to the
	// friendship-only path). The market context is preserved — we only read the
	// query string, never redirect.
	//
	// Idempotency / guard rails:
	//   - Stash only when no `referralCode` is already pending (a user already
	//     attributed to a referrer is never overwritten). The satellite enforces
	//     one-redemption-per-referee and self-referral rejection.
	//   - The share URL falls back to the sharer's handle when their referral
	//     code hasn't loaded yet (`refToken = referralCode ?? handle`); a handle
	//     fails `REFERRAL_CODE_REGEX`, so malformed / non-code `?ref=` values are
	//     ignored here gracefully.
	const captureSharedReferral = (code: string): void => {
		try {
			const raw = localStorage.getItem(PENDING_ONBOARDING_STORAGE_KEY);
			const parsed: Record<string, unknown> =
				raw !== null
					? ((): Record<string, unknown> => {
							try {
								const v: unknown = JSON.parse(raw);

								return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
							} catch {
								return {};
							}
						})()
					: {};

			// Never overwrite an existing attribution — first referrer wins.
			if (typeof parsed.referralCode === 'string' && parsed.referralCode.length > 0) {
				return;
			}

			parsed.referralCode = code;
			localStorage.setItem(PENDING_ONBOARDING_STORAGE_KEY, JSON.stringify(parsed));
		} catch {
			// Best-effort: attribution is cosmetic relative to the rest of the
			// visit and must never break navigation if storage is unavailable.
		}
	};

	$effect(() => {
		if (!browser) {
			return;
		}

		// Attribution targets *incoming* visitors only. An already-signed-in
		// session that opens a share link is an established user who was never
		// referred — stashing the `?ref=` code here would let the post-signin
		// drain below mis-fire `claimReferralFriendship` for them. Skip the
		// capture for signed-in sessions, mirroring how the genuine `/i/{code}`
		// pre-auth stash only runs while signed-out.
		if ($userSignedIn) {
			return;
		}

		const rawRef = page.url.searchParams.get('ref');

		if (rawRef === null) {
			return;
		}

		const normalized = rawRef.toUpperCase().trim();

		if (!REFERRAL_CODE_REGEX.test(normalized)) {
			return;
		}

		captureSharedReferral(normalized);
	});

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
				leagueInvite?: string;
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
		const rawLeagueInvite =
			'leagueInvite' in parsed && typeof parsed.leagueInvite === 'string'
				? parsed.leagueInvite.toUpperCase().trim()
				: undefined;
		const leagueInvite =
			rawLeagueInvite && LEAGUE_INVITE_CODE_REGEX.test(rawLeagueInvite)
				? rawLeagueInvite
				: undefined;

		// At least one actionable signal is required for the payload to be useful — onboarding
		// picks (handle / participantId / side) drive the profile upsert, `referralCode` drives
		// the redeem-or-friendship flow, `leagueInvite` drives the auto-join, and `email` (stashed
		// by the passkey-backed email sign-up) is persisted onto the new profile. A bare payload
		// with none of those is dropped so the caller can clear the slot.
		if (
			handle === null &&
			participantId === null &&
			side === null &&
			referralCode === undefined &&
			leagueInvite === undefined &&
			email === undefined
		) {
			return;
		}

		return {
			handle,
			participantId,
			side,
			interests,
			email,
			referralCode,
			leagueInvite
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

	/**
	 * Best-effort post-signin auto-join of the pre-auth league invite (stashed by
	 * `/league/[code]` when the user was signed-out). Idempotent — "already a member" is
	 * a silent no-op. Errors are swallowed (logged): the invite is cosmetic relative to the
	 * rest of onboarding, and the user can still join manually with the code.
	 */
	const joinPendingLeagueIfAny = async (code: string | undefined): Promise<void> => {
		if (!code) {
			return;
		}

		try {
			const league = await joinLeagueByInvite({ inviteCode: code });

			notificationsStore.add({
				title: t({
					locale: $localeStore,
					key: 'league_invite.joined_title',
					params: { name: league.name }
				}),
				message: t({ locale: $localeStore, key: 'league_invite.joined_body' }),
				type: 'success'
			});
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : '';

			// Already a member is a no-op success — nothing to surface.
			if (message !== 'Already a member of this league.') {
				console.warn('joinPendingLeagueIfAny failed', message || err);
			}
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

			// A stashed league invite is still actionable for a returning user — join is
			// independent of the signup bonus. Fire-and-forget like the friendship above.
			void joinPendingLeagueIfAny(pending.leagueInvite);

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

					if (!probe.available) {
						// Any unavailable reason — `'taken'`, or the
						// `'too_short'` / `'required'` cases that
						// `parsePendingOnboarding`'s tolerated legacy payloads
						// can still produce — must SKIP the nickname update.
						// Only the collision case is worth a toast; the user
						// can rename later from their profile.
						if (probe.reason === 'taken') {
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
						}

						// Apply interests + email + team/side/completion
						// even when the handle is skipped — they're
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
						void joinPendingLeagueIfAny(pending.leagueInvite);

						return;
					}

					// Stamp the handle-change time so the set-profile assertion
					// accepts the write. The satellite requires
					// `handleLastChangeMs` ≈ now whenever the (normalized)
					// nickname differs from the stored doc, and rejects a moved
					// stamp when it is unchanged — so stamp only on a real change.
					// The bootstrapped nickname almost always differs from the
					// picked handle, which is the case that was failing.
					const handleChanged =
						pending.handle.trim().toLowerCase() !==
						(currentProfile.nickname ?? '').trim().toLowerCase();

					nextProfile = {
						...baseUpdated,
						nickname: pending.handle,
						...(handleChanged && { handleLastChangeMs: Date.now() })
					};
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
				void joinPendingLeagueIfAny(pending.leagueInvite);
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : '';

				// Surface the real failure — the generic toast below otherwise
				// swallows it, which is what made this class of bug invisible.
				console.error('Onboarding handoff (pre-auth drain) failed:', err);

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

<div
	style:--navpill-h={$userSignedIn ? '88px' : '0px'}
	class="relative isolate flex h-full flex-col"
>
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
		Flow and market detail. The one exception is anonymous visitors
		on public routes (`/markets`, `/markets/*`, `/info/*`) — the
		navpill's tabs all point at auth-gated areas, so showing it to a
		signed-out user is a dead-end. On market detail the YES/NO CTA
		bar floats above the navpill rather than replacing it.
	-->
	{#if $userSignedIn}
		<MobileNav />
	{/if}

	<CompanionOverlay />

	<!--
		Slide-in notification toast. Mounted at the shell level so it
		surfaces on any signed-in surface the moment a genuinely new inbox
		item arrives (see `inbox.store.ts`'s `latestInboxToast`). Pinned to
		the top of the viewport, above the content.
	-->
	<NotifToastHost />

	<!--
		Recovery-on-return gate. Self-hides when the profile is active, so
		it's inert for normal users; covers the shell only for a returning
		soft-deleted / hibernated account until they recover, resume, or
		sign out.
	-->
	<AccountReturnGate />
</div>
