import { clearInboxState } from '$lib/stores/inbox.store';
import { clearDailyGoalMirror } from '$lib/utils/daily-goal.utils';
import { resetMotionState } from '$lib/utils/motion-engine.utils';
import { clearOnboardingSeenFlags } from '$lib/utils/onboarding-flags.utils';
import { del, get, set } from '$lib/utils/storage.utils';

/**
 * Principal that the identity-scoped local caches in this browser currently
 * belong to. Persisted so a same-user page reload is distinguishable from a
 * genuine identity change: only the latter must wipe the caches.
 *
 * A blind wipe on every auth bootstrap would clear them on a normal reload
 * too, which would defeat the offline-resilient daily-goal cap mirror
 * (it exists precisely to survive a refresh after a dropped server write).
 */
const STORAGE_OWNER_KEY = 'vici.storage-owner.v1';

/**
 * Reconcile the browser-persisted, identity-scoped caches against the
 * signed-in principal. When the owner changes — sign-in as a different
 * principal, sign-out, or an account switch on a shared device — every such
 * cache is dropped so the previous identity's state never bleeds into the
 * next one. When the owner is unchanged (e.g. a same-user reload) the caches
 * are kept intact.
 *
 * Scope: this guards only LOCAL-authoritative state that has no server copy
 * to reload from — the daily-goal cap mirror, the motion-engine state, the
 * inbox read-state, and the onboarding "seen" flags. Server-backed caches
 * (friends, positions, trade history, …) are NOT handled here; `Authn`
 * already resets those unconditionally on every auth transition because
 * `<Loaders />` repopulates them from the satellite.
 */
export const reconcileIdentityScopedStorage = ({
	ownerKey
}: {
	ownerKey: string | undefined;
}): void => {
	const previousOwner = get<string>({ key: STORAGE_OWNER_KEY });

	if (previousOwner === ownerKey) {
		return;
	}

	clearDailyGoalMirror();
	resetMotionState();
	clearInboxState();
	clearOnboardingSeenFlags();

	if (ownerKey === undefined) {
		del({ key: STORAGE_OWNER_KEY });
	} else {
		set({ key: STORAGE_OWNER_KEY, value: ownerKey });
	}
};
