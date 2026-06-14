import { browser } from '$app/environment';
import type { AppLocale } from '$lib/constants/locale.constants';
import {
	nicknameUniqueKey,
	PENDING_ONBOARDING_STORAGE_KEY
} from '$lib/constants/profile.constants';
import {
	REFERRAL_CODE_REGEX,
	REFERRAL_EXISTING_USER_REASON,
	REFERRAL_VXP_BONUS_BASE_UNITS
} from '$lib/constants/referral.constants';
import { track } from '$lib/services/analytics.services';
import { joinLeagueByInvite } from '$lib/services/leagues.services';
import { checkNicknameAvailability, upsertProfile } from '$lib/services/profile.services';
import { claimReferralFriendship, redeemReferralCode } from '$lib/services/referral.services';
import { notificationsStore } from '$lib/stores/notification.store';
import { userStore } from '$lib/stores/user.store';
import { LEAGUE_INVITE_CODE_REGEX } from '$lib/types/league';
import type { UserProfile } from '$lib/types/profile';
import { t } from '$lib/utils/i18n.utils';
import { formatVxpBalance } from '$lib/utils/playground-display.utils';
import { isNullish, nonNullish } from '@dfinity/utils';

/**
 * Pre-auth onboarding payload stashed under {@link PENDING_ONBOARDING_STORAGE_KEY} while the
 * visitor is signed-out (by the 3-beat onboarding flow, the `/i/{code}` referral landing, the
 * `/league/[code]` invite landing, or a share-link `?ref=` capture). Drained post-signin by
 * {@link drainPendingOnboarding}.
 */
interface PendingOnboarding {
	handle: string | null;
	participantId: string | null;
	side: 'YES' | 'NO' | null;
	interests: string[];
	email?: string;
	referralCode?: string;
	leagueInvite?: string;
}

/**
 * Typed outcome of {@link drainPendingOnboarding}. The layout maps this to the primary
 * notification toast; the best-effort referral / league side-flows surface their own toasts
 * from inside the service.
 */
export type DrainOutcome =
	| { kind: 'noop' }
	| { kind: 'account_exists'; nickname: string }
	| { kind: 'applied' }
	| { kind: 'collision'; handle: string }
	| { kind: 'failed' };

const parsePendingOnboarding = (raw: string): PendingOnboarding | undefined => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(raw);
	} catch {
		parsed = null;
	}

	if (typeof parsed !== 'object' || isNullish(parsed)) {
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
		rawLeagueInvite && LEAGUE_INVITE_CODE_REGEX.test(rawLeagueInvite) ? rawLeagueInvite : undefined;

	// At least one actionable signal is required for the payload to be useful — onboarding
	// picks (handle / participantId / side) drive the profile upsert, `referralCode` drives
	// the redeem-or-friendship flow, `leagueInvite` drives the auto-join, and `email` (stashed
	// by the passkey-backed email sign-up) is persisted onto the new profile. A bare payload
	// with none of those is dropped so the caller can clear the slot.
	if (
		isNullish(handle) &&
		isNullish(participantId) &&
		isNullish(side) &&
		isNullish(referralCode) &&
		isNullish(leagueInvite) &&
		isNullish(email)
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
const redeemPendingReferralIfAny = async ({
	code,
	locale,
	source
}: {
	code: string | undefined;
	locale: AppLocale;
	source: string;
}): Promise<void> => {
	if (!code) {
		return;
	}

	try {
		await redeemReferralCode({ code });

		track({ name: 'referral_redeemed', source });

		notificationsStore.add({
			title: t({
				locale,
				key: 'onboarding.handoff.referral_ok_title'
			}),
			message: t({
				locale,
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

				track({ name: 'referral_redeemed', source });

				notificationsStore.add({
					title: t({
						locale,
						key: 'onboarding.handoff.referral_late_title'
					}),
					message: t({
						locale,
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
				locale,
				key: 'onboarding.handoff.referral_failed_title'
			}),
			message: t({
				locale,
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
const joinPendingLeagueIfAny = async ({
	code,
	locale
}: {
	code: string | undefined;
	locale: AppLocale;
}): Promise<void> => {
	if (!code) {
		return;
	}

	try {
		const league = await joinLeagueByInvite({ inviteCode: code });

		notificationsStore.add({
			title: t({
				locale,
				key: 'league_invite.joined_title',
				params: { name: league.name }
			}),
			message: t({ locale, key: 'league_invite.joined_body' }),
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

/**
 * Cheap synchronous peek: is there a pending-onboarding payload stashed? Lets the caller skip
 * arming its mid-drain guard when there's nothing to drain (so the forced-onboarding redirect
 * isn't held off on the common empty path). Browser-guarded — `false` in any non-browser context.
 */
export const hasPendingOnboarding = (): boolean =>
	browser && nonNullish(localStorage.getItem(PENDING_ONBOARDING_STORAGE_KEY));

/**
 * Drains the pre-auth onboarding payload for a freshly signed-in session: parses the stash,
 * branches on returning-vs-new user, applies the profile upsert (with a nickname-collision
 * probe), clears the storage slot, and kicks off the best-effort referral redeem + league
 * auto-join. Returns a {@link DrainOutcome} the caller maps to the primary notification toast.
 *
 * Preconditions (the caller must already have verified): running in the browser, signed-in,
 * a hydrated `userStore.profile`, and that this is not already mid-drain.
 *
 * @param locale the active app locale, for the best-effort side-flow toasts emitted here.
 * @param profile the hydrated profile snapshot (`$userStore.profile`).
 * @param profileExisted whether the satellite already held a profile at sign-in time
 *        (`$userStore.profileExisted`).
 */
export const drainPendingOnboarding = async ({
	locale,
	profile,
	profileExisted
}: {
	locale: AppLocale;
	profile: UserProfile;
	profileExisted: boolean;
}): Promise<DrainOutcome> => {
	if (!browser) {
		return { kind: 'noop' };
	}

	const raw = localStorage.getItem(PENDING_ONBOARDING_STORAGE_KEY);

	if (!raw) {
		return { kind: 'noop' };
	}

	const pending = parsePendingOnboarding(raw);

	if (!pending) {
		localStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY);

		return { kind: 'noop' };
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
	if (profileExisted) {
		if (nonNullish(pending.referralCode)) {
			const friendshipCode = pending.referralCode;

			void (async () => {
				try {
					await claimReferralFriendship({ code: friendshipCode });

					track({
						name: 'referral_redeemed',
						source: nonNullish(pending.leagueInvite) ? 'league_invite' : 'onboarding'
					});

					notificationsStore.add({
						title: t({
							locale,
							key: 'onboarding.handoff.referral_late_title'
						}),
						message: t({
							locale,
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
		void joinPendingLeagueIfAny({ code: pending.leagueInvite, locale });

		localStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY);

		return { kind: 'account_exists', nickname: profile.nickname };
	}

	// Onboarding picks live under `preferences`. Always apply
	// team/side/onboardingCompleted on the new-user path — the user
	// just finished the 3-beat flow, so completion is recorded even
	// when they skipped the picks. Preserve everything else under
	// `preferences` so the seed defaults stay intact.
	const sidePreference = pending.side ?? '';
	const participantPreference = pending.participantId ?? '';
	const baseUpdated = {
		...profile,
		interests: pending.interests,
		...(pending.email && { email: pending.email }),
		preferences: {
			...profile.preferences,
			favoriteParticipantId: participantPreference,
			favoriteSide: sidePreference,
			onboardingCompleted: true
		}
	};

	try {
		let nextProfile = baseUpdated;

		if (nonNullish(pending.handle)) {
			// Pre-flight: a brand-new user can still collide if
			// the handle was claimed in the window between
			// onboarding step 4 and sign-in landing. Probe first
			// so we can keep team/side/onboardingCompleted (which
			// are independent of the handle) and let the user
			// rename later from their profile.
			const probe = await checkNicknameAvailability({
				nickname: pending.handle,
				principal: profile.owner
			});

			if (!probe.available) {
				// Apply interests + email + team/side/completion
				// even when the handle is skipped — they're
				// independently useful and the user can rename
				// later.
				await upsertProfile({
					key: profile.owner,
					data: baseUpdated
				});

				userStore.update((curr) => ({ ...curr, profile: baseUpdated }));
				localStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY);

				// Handle collision is independent of the referral redemption — the user is still a
				// new sign-up and deserves the bonus.
				void redeemPendingReferralIfAny({
					code: pending.referralCode,
					locale,
					source: nonNullish(pending.leagueInvite) ? 'league_invite' : 'onboarding'
				});
				void joinPendingLeagueIfAny({ code: pending.leagueInvite, locale });

				// Any unavailable reason — `'taken'`, or the
				// `'too_short'` / `'required'` cases that
				// `parsePendingOnboarding`'s tolerated legacy payloads
				// can still produce — must SKIP the nickname update.
				// Only the collision case is worth a toast; the user
				// can rename later from their profile.
				return probe.reason === 'taken'
					? { kind: 'collision', handle: pending.handle }
					: { kind: 'applied' };
			}

			// Stamp the handle-change time so the set-profile assertion
			// accepts the write. The satellite requires
			// `handleLastChangeMs` ≈ now whenever the (normalized)
			// nickname differs from the stored doc, and rejects a moved
			// stamp when it is unchanged — so stamp only on a real change.
			// The bootstrapped nickname almost always differs from the
			// picked handle, which is the case that was failing.
			const handleChanged =
				nicknameUniqueKey(pending.handle) !== nicknameUniqueKey(profile.nickname ?? '');

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
		void redeemPendingReferralIfAny({
			code: pending.referralCode,
			locale,
			source: nonNullish(pending.leagueInvite) ? 'league_invite' : 'onboarding'
		});
		void joinPendingLeagueIfAny({ code: pending.leagueInvite, locale });

		return { kind: 'applied' };
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : '';

		// Surface the real failure — the generic toast otherwise
		// swallows it, which is what made this class of bug invisible.
		console.error('Onboarding handoff (pre-auth drain) failed:', err);

		localStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY);

		if (message.includes('already taken')) {
			return { kind: 'collision', handle: pending.handle ?? '' };
		}

		return { kind: 'failed' };
	}
};
