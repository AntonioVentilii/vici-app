import { INBOX_SETTLED_READ_STORAGE_KEY, INBOX_STORAGE_KEY } from '$lib/constants/inbox.constants';
import { clearDailyGoalMirror } from '$lib/utils/daily-goal.utils';
import { resetMotionState } from '$lib/utils/motion-engine.utils';
import { clearOnboardingSeenFlags } from '$lib/utils/onboarding-flags.utils';
import { del, get, set } from '$lib/utils/storage.utils';

// Principal the identity-scoped caches currently belong to. Persisted so a
// same-user reload is distinguishable from a real identity change.
const STORAGE_OWNER_KEY = 'vici.storage-owner.v1';

/**
 * Drop the browser-persisted, identity-scoped caches when the signed-in
 * principal changes (sign-in as a different user, sign-out, account switch),
 * so one identity's state never bleeds into the next on a shared device.
 *
 * Only clears on an actual owner change — NOT on a same-user reload, which
 * would defeat the offline-resilient daily-goal mirror (it exists to survive
 * a refresh after a dropped server write). Scope is local-authoritative state
 * with no server copy to reload from; server-backed caches are handled
 * separately in `Authn`.
 *
 * First observation (no persisted owner yet) counts as a change and clears:
 * that's intentional, so already-affected devices from before this guard
 * shipped get cleaned on the next sign-in rather than keeping their leak. The
 * daily-goal profile reconcile re-establishes the real count immediately.
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
	clearOnboardingSeenFlags();
	// Inbox read-state: delete the persisted keys directly. We deliberately
	// don't import `inbox.store` (it starts a long-lived toast subscription
	// at import, and <Authn> is in the root layout that also wraps the
	// signed-out/marketing path). The in-memory inbox stores re-read these
	// keys on their next load, which is when the next identity opens the app.
	del({ key: INBOX_STORAGE_KEY });
	del({ key: INBOX_SETTLED_READ_STORAGE_KEY });

	if (ownerKey === undefined) {
		del({ key: STORAGE_OWNER_KEY });
	} else {
		set({ key: STORAGE_OWNER_KEY, value: ownerKey });
	}
};
