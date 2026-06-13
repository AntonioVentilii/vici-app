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
 * helper uses), signs in via the dev mock identity, and asserts it lands
 * on the signed-in profile shell.
 *
 * NOTE: this deliberately does not assert the *picked* handle shows up on
 * the profile. On the dev provider the picked handle is currently dropped
 * — `signIn({ dev: {} })` resolves and fires `onSuccess` before the new
 * profile loads, so `/signup`'s `handleCompleteAuthenticated` bails on the
 * still-null profile and neither handoff path persists the handle (the
 * profile shows the bootstrapped principal default instead). That's a real
 * app bug tracked separately, not a flow this test should encode as
 * expected behaviour.
 */
test.describe('pre-sign-in onboarding', () => {
	test('walks the beats and the handle-claim path lands signed in', async ({ page }) => {
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
		await suggestion.click();
		await home.onboardingPrimary.click();

		// Beat 3 — sign in with the dev mock identity.
		await home.signInDevButton.waitFor({ state: 'visible' });
		await home.signInDevButton.click();

		await home.waitForSignedInShell();

		// The handle-claim path completed and reached the signed-in app.
		await page.goto('/profile');

		await expect(home.appMain).toBeVisible();
		await expect(home.userMenu).toBeVisible();
	});
});
