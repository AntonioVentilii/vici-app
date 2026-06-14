import { expect, test } from '@playwright/test';
import { HomePage } from './pages/home.page';

/**
 * Pre-sign-in onboarding (`/signup`) — the 3-beat flow:
 *
 *   Beat 1.a · team picker (skip → "just following the tournament")
 *   Beat 1.b · derived first-call card (swipe to commit a side)
 *   Beat 2   · claim a handle (pool suggestion or custom)
 *   Beat 3   · auth — the dev provider locks the record
 *
 * Walks the whole flow taking the handle-claim branch (Beat 2 pool pick →
 * primary CTA, distinct from the skip path the page object's sign-in
 * helper uses), signs in via the dev mock identity, and asserts the picked
 * handle survives the handoff onto the new profile.
 *
 * The dev provider resolves `signIn({ dev: {} })` synchronously and fires
 * `onSuccess` before the new profile hydrates, so `/signup`'s
 * `handleCompleteAuthenticated` can't upsert the picks immediately — it
 * falls back to the pending-onboarding stash, which the `(app)` layout
 * drain applies once the profile lands. This test guards that path: the
 * profile hero must show the picked handle, not the bootstrapped principal
 * default.
 */
test.describe('pre-sign-in onboarding', () => {
	test('walks the beats and applies the picked handle after dev sign-in', async ({ page }) => {
		const home = new HomePage(page);

		await page.goto('/signup');

		await expect(home.onboardingFlow).toBeVisible();

		// Beat 1.a — skip the team picker.
		await home.onboardingTeamSkip.click();

		// Beat 1.b — swipe the first-call card to commit a side.
		await home.commitFirstCall();

		// Beat 2 — pool mode is the default. Pick the first ENABLED
		// suggestion: chips for already-taken handles render `disabled`, and
		// `.first()` could otherwise resolve to one of those and fail the
		// click. Then advance via the primary claim CTA.
		const suggestion = page
			.locator(`[data-tid="onboarding-handle-suggestion"]:not([disabled])`)
			.first();
		await suggestion.waitFor({ state: 'visible' });

		// The chip renders `@{handle}`; capture the handle so we can assert it
		// survives the dev-provider handoff onto the profile.
		const pickedHandle = (await suggestion.innerText()).trim().replace(/^@\s*/, '');

		expect(pickedHandle.length).toBeGreaterThan(0);

		await suggestion.click();
		await home.onboardingPrimary.click();

		// Beat 3 — sign in with the dev mock identity.
		await home.signInDevButton.waitFor({ state: 'visible' });
		await home.signInDevButton.click();

		await home.waitForSignedInShell();

		// The handle handoff is applied asynchronously by the `(app)` layout
		// drain once the profile hydrates (see the file header): it upserts the
		// picked handle to the satellite, then clears the pre-auth stash under
		// `vici:pending-onboarding`. Wait for that slot to drain before
		// navigating — a full page load to `/profile` re-bootstraps from the
		// satellite, and doing it mid-drain would read the not-yet-persisted
		// profile (and flip the drain onto its returning-user branch), racing
		// the handoff. Waiting on the slot can't mask a real failure: every
		// drain outcome clears it, so a failed upsert still fails the handle
		// assertion below.
		await expect
			.poll(() => page.evaluate(() => localStorage.getItem('vici:pending-onboarding')), {
				timeout: 30_000
			})
			.toBeNull();

		// The handle-claim path completed and reached the signed-in app.
		await page.goto('/profile');

		await expect(home.appMain).toBeVisible();
		await expect(home.userMenu).toBeVisible();

		// The picked handle survived the dev-provider handoff — the profile
		// hero shows `@{handle}`, not the bootstrapped principal default. The
		// hero handle is an editable button (`.profile-hero-handle`) on one's
		// own profile and an `<h1>` on others'; both carry that class, so
		// target it directly rather than the element type.
		await expect(
			home.appMain.locator('.profile-hero-handle').filter({ hasText: `@${pickedHandle}` })
		).toBeVisible();
	});
});
