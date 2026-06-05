import { del } from '$lib/utils/storage.utils';

/**
 * One-time "seen" markers for the onboarding / coaching overlays. Each is a
 * presence flag in localStorage (`'1'` once the overlay has been dismissed):
 *
 * - {@link COACH_ONBOARDING_SEEN_KEY} / {@link COACH_FLOW_SEEN_KEY} — the
 *   `FlowCoach` first-run gesture coach, one flag per surface.
 * - {@link BATTLES_INTRO_SEEN_KEY} — the "What's a battle?" intro card on
 *   the Battles inbox.
 *
 * They are scoped to the signed-in identity: a different principal on a
 * shared device must be coached again rather than inherit the previous
 * user's "already seen" state. {@link clearOnboardingSeenFlags} drops them
 * on every identity change — see `reconcileIdentityScopedStorage`.
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
