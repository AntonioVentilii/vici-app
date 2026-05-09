import { expect, test } from '@playwright/test';
import { HomePage } from './pages/home.page';

const REGISTRY_QUERY_GLOB = '**/api/v3/canister/g5pxl-pyaaa-aaaaj-qqhoq-cai/**';

test.describe('homepage (logged out)', () => {
	test('renders the loading skeletons while markets are still being fetched', async ({ page }) => {
		const home = new HomePage(page);

		// Stall every Registry query so the feed stays in its skeleton state long
		// enough for a deterministic screenshot. We hold the route handler on a
		// deferred promise we explicitly release in `finally` — this avoids a
		// long-lived `setTimeout` that could outlive the test and keep the
		// Playwright worker process alive.
		let releaseStall!: () => void;
		const stalled = new Promise<void>((resolve) => {
			releaseStall = resolve;
		});

		await page.route(REGISTRY_QUERY_GLOB, async (route) => {
			await stalled;
			await route.abort();
		});

		try {
			await home.goto();

			await expect(home.marketFeed).toBeVisible();
			await expect(home.marketCardSkeleton.first()).toBeVisible();
			await expect(home.signInButton).toBeVisible();

			await expect(page).toHaveScreenshot('homepage-loading.png', { fullPage: true });
		} finally {
			releaseStall();
		}
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
