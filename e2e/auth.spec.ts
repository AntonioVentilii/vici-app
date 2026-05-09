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

		await home.openSignInModal();
		await home.signInDevButton.click();

		await expect(home.userMenu).toBeVisible();
		await expect(home.signInButton).not.toBeVisible();

		await home.logout();

		await expect(home.signInButton).toBeVisible();
		await expect(home.userMenu).not.toBeVisible();
	});
});
