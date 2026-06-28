import { browser } from '$app/environment';
import { Collection } from '$lib/constants/collections.constants';
import { isDev } from '$lib/env/app.env';
import { userStore } from '$lib/stores/user.store';
import type { UserProfile } from '$lib/types/profile';
import { isNullish } from '@dfinity/utils';
import { deleteDoc, getDoc } from '@junobuild/core';
import { get } from 'svelte/store';

/**
 * Global handle the dev-only e2e reset hook is exposed under. Typed here (not
 * `any`) so callers and the Playwright `page.evaluate` stay checked.
 */
export interface E2eHooks {
	/** Hard-delete the signed-in principal's profile doc. Resolves once gone. */
	resetMyProfile: () => Promise<void>;
}

declare global {
	interface Window {
		__viciE2E?: E2eHooks;
	}
}

/**
 * Hard-delete the signed-in principal's profile doc so the NEXT sign-in is
 * seen as a brand-new user — `ensureProfile` finds no versioned doc and
 * bootstraps fresh.
 *
 * Exists only to let the Playwright onboarding spec escape the shared dev
 * mock identity: `signIn({ dev: {} })` resolves to ONE principal for the
 * whole CI run, and earlier specs (every `signInAsDevUser`) auto-claim the
 * handle field's pool suggestion and complete onboarding for it — so by the
 * time the onboarding spec runs, that principal is a fully-onboarded
 * returning user and the new-user handle handoff can't be exercised. Deleting
 * the profile first restores the pristine pre-onboarding state.
 *
 * The `profiles` collection is public-write and carries no delete assert, so
 * the owner can remove their own doc.
 *
 * The profile is written concurrently right after sign-in (the finishing
 * login's `calculateAndSyncStats`), so a delete against a just-read version
 * can lose the optimistic-concurrency race and trap
 * `juno.error.version_outdated_or_future`. Re-read fresh and retry until the
 * version is current — the write storm is finite, so this converges once it
 * settles (or the doc is already gone).
 */
const DELETE_ATTEMPTS = 8;
const DELETE_RETRY_DELAY_MS = 250;

const resetMyProfile = async (): Promise<void> => {
	const principal = get(userStore).user?.key;

	if (isNullish(principal)) {
		return;
	}

	for (let attempt = 0; attempt < DELETE_ATTEMPTS; attempt += 1) {
		const existing = await getDoc<UserProfile>({
			collection: Collection.PROFILES,
			key: principal
		});

		if (isNullish(existing)) {
			return;
		}

		try {
			await deleteDoc({ collection: Collection.PROFILES, doc: existing });

			return;
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);

			if (!message.includes('version_outdated_or_future') || attempt === DELETE_ATTEMPTS - 1) {
				throw err;
			}

			// A concurrent write bumped the version between the read and the
			// delete; wait for it to land, then re-read and retry.
			await new Promise((resolve) => setTimeout(resolve, DELETE_RETRY_DELAY_MS));
		}
	}
};

/**
 * Install the e2e reset hook on `window` — DEV ONLY. A no-op in production
 * (and any non-browser context), so it never adds a profile-deletion surface
 * to a real build. Called once from the `(app)` layout on mount.
 */
export const installE2eResetHook = (): void => {
	if (!browser || !isDev()) {
		return;
	}

	window.__viciE2E = { resetMyProfile };
};
