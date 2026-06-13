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
 * This walks the flow picking a pool handle, signs in via the dev mock
 * identity, and asserts the picked handle is applied to the new profile —
 * proving the pre-auth onboarding handoff (`PENDING_ONBOARDING_STORAGE_KEY`
 * → drained by the (app) layout) actually persists.
 */
test.describe('pre-sign-in onboarding', () => {
	test('collects a handle and applies it after dev sign-in', async ({ page }) => {
		const home = new HomePage(page);

		await page.goto('/signup');

		await expect(home.onboardingFlow).toBeVisible();

		// Beat 1.a — skip the team picker.
		await home.onboardingTeamSkip.click();

		// Beat 1.b — swipe the first-call card to commit a side.
		await home.commitFirstCall();

		// Beat 2 — pool mode is the default; pick the first available
		// suggestion and remember the handle it offered so we can assert it
		// landed on the profile. Pool chips render as `@word`; the stored
		// nickname is the bare word.
		const suggestion = home.onboardingHandleSuggestion.first();
		await suggestion.waitFor({ state: 'visible' });
		const handle = (await suggestion.innerText()).replace(/^@/, '').trim();

		await suggestion.click();
		await home.onboardingPrimary.click();

		// Beat 3 — sign in with the dev mock identity; the onboarding handoff
		// drains into the freshly-created profile on the hard-load to /flow.
		await home.signInDevButton.waitFor({ state: 'visible' });
		await home.signInDevButton.click();

		await home.waitForSignedInShell();

		await page.goto('/profile');

		await expect(home.appMain.getByText(handle).first()).toBeVisible();
	});
});
