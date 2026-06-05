import { del } from '$lib/utils/storage.utils';

/**
 * One-time "seen" flags for the onboarding / coaching overlays (`FlowCoach`
 * per surface + the Battles intro card). Identity-scoped, so they're cleared
 * on a principal change — see `reconcileIdentityScopedStorage`.
 */
export const COACH_ONBOARDING_SEEN_KEY = 'vici.coach-onboarding-seen';
export const COACH_FLOW_SEEN_KEY = 'vici.coach-flow-seen';
export const BATTLES_INTRO_SEEN_KEY = 'vici.battles-intro-seen';

const ONBOARDING_SEEN_KEYS = [
	COACH_ONBOARDING_SEEN_KEY,
	COACH_FLOW_SEEN_KEY,
	BATTLES_INTRO_SEEN_KEY
] as const;

/** Drop every onboarding "seen" flag. Best-effort (see `storage.utils`). */
export const clearOnboardingSeenFlags = (): void => {
	for (const key of ONBOARDING_SEEN_KEYS) {
		del({ key });
	}
};
