import { browser } from '$app/environment';
import { Collection } from '$lib/constants/collections.constants';
import { isDev } from '$lib/env/app.env';
import { userStore } from '$lib/stores/user.store';
import type { UserProfile } from '$lib/types/profile';
import { sleep } from '$lib/utils/async.utils';
import { isNullish, nonNullish } from '@dfinity/utils';
import { deleteDoc, getDoc, signOut } from '@junobuild/core';
import { get } from 'svelte/store';

/**
 * Global handle the dev-only e2e reset hook is exposed under. Typed here (not
 * `any`) so callers and the Playwright `page.evaluate` stay checked.
 */
export interface E2eHooks {
	/** Hard-delete the signed-in principal's profile doc. Resolves once gone. */
	resetMyProfile: () => Promise<void>;
	/**
	 * Sign out programmatically (Juno `signOut`), without navigating to the
	 * Settings sign-out surface. Pairs with {@link resetMyProfile}: deleting the
	 * profile and then signing out in place means NO signed-in page load happens
	 * between the two, so `ensureProfile` can't re-bootstrap the doc we just
	 * removed. Fires `onAuthStateChange(null)`; the (app) auth gate then routes
	 * back to `/signin`.
	 */
	signOut: () => Promise<void>;
}

declare global {
	interface Window {
		__viciE2E?: E2eHooks;
	}
}

/**
 * Tail of the in-flight post-sign-in stats syncs (`calculateAndSyncStats`),
 * chained so a single await covers every sync registered so far. DEV ONLY —
 * stays `Promise.resolve()` in production because {@link trackLoginSyncSettled}
 * no-ops there.
 *
 * Why this exists: `calculateAndSyncStats` ends by writing the profile through
 * `patchProfile` → `upsertProfile`, a versionless `setDoc` that CREATES the doc
 * when it reads as absent. So if {@link resetMyProfile} deletes the doc while
 * that sync is still running, the sync's trailing write re-creates it and the
 * next sign-in wrongly looks like a returning user. The sync is a long async
 * chain (trade history + leagues + battles + rank + monthly stats before the
 * write), so its write can land well after any fixed post-delete watch window —
 * which is why watching for resurrection alone was flaky. The deterministic fix
 * is to wait for the sync to fully settle BEFORE deleting.
 */
let loginSyncChain: Promise<void> = Promise.resolve();

/**
 * Register a post-sign-in stats sync so {@link resetMyProfile} can await it
 * before deleting the profile. Called by the auth boundary (`Authn.svelte`) as
 * each sync starts. DEV ONLY (and browser-only): a no-op elsewhere, so it never
 * adds bookkeeping to a real session. Never rejects — a failed sync still
 * settles the chain (a delete after a failed sync is safe).
 */
export const trackLoginSyncSettled = (run: Promise<unknown>): void => {
	if (!browser || !isDev()) {
		return;
	}

	const settled = run.then(
		() => undefined,
		() => undefined
	);

	loginSyncChain = Promise.all([loginSyncChain, settled]).then(() => undefined);
};

/**
 * Resolve once no tracked login sync is in flight. Re-awaits until the chain
 * reference stops changing, so a sync registered by a second
 * `onAuthStateChange` pass mid-await (the double-fire race) is covered too. The
 * post-sign-in write storm is finite, so this converges.
 */
const waitForLoginSyncSettled = async (): Promise<void> => {
	let awaited: Promise<void> | undefined;

	while (awaited !== loginSyncChain) {
		awaited = loginSyncChain;

		await awaited;
	}
};

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
 * The chief resurrector is the finishing login's `calculateAndSyncStats`: it
 * fetches trade history (and leagues / battles / rank / monthly stats) before
 * writing the profile through `upsertProfile`'s versionless `setDoc` (absent
 * doc → create). If that write lands after our delete, the doc resurrects and
 * the next sign-in wrongly looks like a returning user. Because its write can
 * come well after any fixed post-delete watch window, we first
 * {@link waitForLoginSyncSettled} — the sync is tracked by `Authn.svelte` via
 * {@link trackLoginSyncSettled} — so the delete has nothing racing it.
 *
 * Two further races can still leave the doc present after a naive delete:
 *
 *  1. A concurrent write bumps the version between our read and our delete, so
 *     `deleteDoc` traps `juno.error.version_outdated_or_future`. Re-read fresh
 *     and retry until the version is current.
 *
 *  2. A stray write re-creates the doc just after our delete. Belt-and-braces
 *     for anything the sync-settle wait didn't cover, we watch for a
 *     resurrecting write across a settle window and re-delete if the doc
 *     reappears.
 *
 * The post-sign-in write storm is finite, so this converges once it drains.
 * The caller must then sign out
 * WITHOUT a signed-in page load in between (use {@link E2eHooks.signOut}, not a
 * navigation to the Settings surface) — a signed-in navigation would re-run
 * `ensureProfile` and bootstrap a fresh doc, which no watching here can prevent.
 */
const DELETE_ATTEMPTS = 10;
const DELETE_RETRY_DELAY_MS = 250;
/** How long the doc must stay absent after a delete to be considered settled. */
const RESURRECTION_WATCH_MS = 2_000;
const RESURRECTION_POLL_MS = 250;

const readProfileDoc = (principal: string) =>
	getDoc<UserProfile>({ collection: Collection.PROFILES, key: principal });

const resetMyProfile = async (): Promise<void> => {
	const principal = get(userStore).user?.key;

	if (isNullish(principal)) {
		return;
	}

	// Let the post-sign-in stats sync finish its profile write FIRST, so it
	// can't resurrect the doc we're about to delete (see the header).
	await waitForLoginSyncSettled();

	for (let attempt = 0; attempt < DELETE_ATTEMPTS; attempt += 1) {
		const existing = await readProfileDoc(principal);

		let deleted = true;

		if (nonNullish(existing)) {
			try {
				await deleteDoc({ collection: Collection.PROFILES, doc: existing });
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);

				if (!message.includes('version_outdated_or_future') || attempt === DELETE_ATTEMPTS - 1) {
					throw err;
				}

				// A concurrent write bumped the version between the read and the
				// delete; wait for it to land, then re-read and retry on the next
				// loop pass.
				await sleep(DELETE_RETRY_DELAY_MS);

				deleted = false;
			}
		}

		if (deleted) {
			// The doc is gone. Confirm it STAYS gone — a trailing post-sign-in
			// write can re-create it (see the header). If it reappears within the
			// window, loop and delete the resurrected doc; otherwise the reset is
			// settled.
			let resurrected = false;

			for (let waited = 0; waited < RESURRECTION_WATCH_MS; waited += RESURRECTION_POLL_MS) {
				await sleep(RESURRECTION_POLL_MS);

				if (nonNullish(await readProfileDoc(principal))) {
					resurrected = true;

					break;
				}
			}

			if (!resurrected) {
				return;
			}
		}
	}

	throw new Error(
		'resetMyProfile: profile doc kept being re-created after delete — the post-sign-in write storm never settled.'
	);
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

	window.__viciE2E = { resetMyProfile, signOut: () => signOut() };
};
