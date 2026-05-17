import { expect, test } from '@playwright/test';
import { HomePage } from './pages/home.page';

/**
 * Sign-in flow against the Juno emulator using the dev-only mock identity
 * (`signIn({ dev: {} })`) — the same path Juno's official E2E guide
 * recommends and that `@junobuild/emulator-playwright` uses under the
 * hood. Real Internet Identity flows can be added in a follow-up; the
 * `SignInDev` button exercises the same `onAuthStateChange` pipeline,
 * which is what makes a sign-in / sign-out test useful.
 */
test.describe('authentication (dev sign-in)', () => {
	test('signs in via the dev mock identity and signs back out', async ({ page }) => {
		const home = new HomePage(page);

		await home.goto();

		await expect(home.signInButton).toBeVisible();

		await home.signInAsDevUser();

		await expect(home.userMenu).toBeVisible();
		await expect(home.signInButton).not.toBeVisible();
		await expect(home.marketCard.first()).toBeVisible();

		// `marketCard.first()` only proves at least one card has rendered;
		// the remaining 19 may still be streaming in. Wait for `networkidle`
		// to pin the feed in its fully-loaded state before snapshotting,
		// otherwise the baseline drifts whenever a card lands a few ms
		// late and CI auto-commits a "new" snapshot on the next run.
		await page.waitForLoadState('networkidle');

		await home.stabilizeForSnapshot();

		// Mask the user-menu trigger only — dev sign-in mints a fresh principal
		// each run, so the avatar / fallback initials genuinely differ. The
		// time-remaining chips are handled by `stabilizeForSnapshot` instead
		// (masking variable-width text doesn't actually pin the snapshot —
		// see `HomePage.stabilizeForSnapshot` for the full rationale).
		await expect(page).toHaveScreenshot('homepage-logged-in.png', {
			fullPage: true,
			mask: [home.userMenu]
		});

		await home.logout();

		await expect(home.signInButton).toBeVisible();
		await expect(home.userMenu).not.toBeVisible();
	});
});
