import { expect, test } from '@playwright/test';
import { HomePage } from './pages/home.page';

/**
 * Sign-in flow against the Juno emulator using the dev-only mock identity
 * (`signIn({ dev: {} })`) — the same path Juno's official E2E guide
 * recommends. Real Internet Identity flows can be added in a follow-up;
 * the `SignInDev` button exercises the same `onAuthStateChange` pipeline,
 * which is what makes a sign-in / sign-out test useful.
 *
 * Phase 1 routing change: every (app) route is auth-gated and
 * unauthenticated visits redirect to `/signin`. The dev sign-in button
 * lives on the `SignInScreen` directly — there's no modal anymore.
 */
test.describe('authentication (dev sign-in)', () => {
	test('signs in via the dev mock identity and signs back out', async ({ page }) => {
		const home = new HomePage(page);

		// Anonymous landing on `/` redirects to `/signin`. Wait for the
		// gate to settle so subsequent assertions see a stable URL.
		await home.goto();
		await page.waitForURL('**/signin');

		// SignInScreen renders the dev provider directly (no modal).
		await expect(home.signInDevButton).toBeVisible();

		await home.signInAsDevUser();

		await expect(home.userMenu).toBeVisible();
		await expect(home.marketCard.first()).toBeVisible();

		// `marketCard.first()` only proves at least one card has rendered;
		// the remaining 19 may still be streaming in. Wait for `networkidle`
		// to pin the feed in its fully-loaded state before snapshotting,
		// otherwise the baseline drifts whenever a card lands a few ms
		// late and CI auto-commits a "new" snapshot on the next run.
		await page.waitForLoadState('networkidle');

		await home.stabilizeForSnapshot();

		// Mask the user-menu trigger only — dev sign-in mints a fresh
		// principal each run, so the avatar / fallback initials genuinely
		// differ. Time-remaining chips are handled by
		// `stabilizeForSnapshot` instead.
		await expect(page).toHaveScreenshot('homepage-logged-in.png', {
			fullPage: true,
			mask: [home.userMenu]
		});

		await home.logout();

		// Sign-out routes the user back through the auth gate to /signin.
		await page.waitForURL('**/signin');

		await expect(home.signInDevButton).toBeVisible();
		await expect(home.userMenu).not.toBeVisible();
	});
});
