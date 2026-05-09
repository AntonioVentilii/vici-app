import { expect, test } from '@playwright/test';
import { HomePage } from './pages/home.page';

const REGISTRY_QUERY_GLOB = '**/api/v3/canister/g5pxl-pyaaa-aaaaj-qqhoq-cai/**';

test.describe('homepage (logged out)', () => {
	test('renders the loading skeletons while markets are still being fetched', async ({ page }) => {
		const home = new HomePage(page);

		// Stall every Registry query so the feed stays in its skeleton state long
		// enough for a deterministic screenshot. We never call route.continue —
		// Playwright tears the request down at the end of the test, which is fine
		// because we only care about the rendered DOM, not the round-trip.
		await page.route(REGISTRY_QUERY_GLOB, async () => {
			await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));
		});

		await home.goto();

		await expect(home.marketFeed).toBeVisible();
		await expect(home.marketCardSkeleton.first()).toBeVisible();
		await expect(home.signInButton).toBeVisible();

		await expect(page).toHaveScreenshot('homepage-loading.png', { fullPage: true });
	});

	test('renders the markets feed once data is loaded', async ({ page }) => {
		const home = new HomePage(page);

		await home.goto();

		await expect(home.marketFeed).toBeVisible();
		await expect(home.marketCard.first()).toBeVisible();
		await expect(home.signInButton).toBeVisible();

		// "X days left" / "X hours left" drift relative to the wall clock; mask
		// every instance so the screenshot stays stable regardless of when CI ran.
		await expect(page).toHaveScreenshot('homepage-with-markets.png', {
			fullPage: true,
			mask: [home.marketTimeRemaining]
		});
	});
});
