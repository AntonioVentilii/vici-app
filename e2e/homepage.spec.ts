import { expect, test } from '@playwright/test';
import { HomePage } from './pages/home.page';

// Match every API version (v2/v3/v4 — the SDK uses v3 for `query` /
// `read_state` and v4 for `call`) and any path under the Registry canister.
// A v3-only glob lets v4 update calls leak through and quietly populate the
// feed before the screenshot, which is exactly what made this test flaky.
const REGISTRY_GLOB = '**/api/*/canister/g5pxl-pyaaa-aaaaj-qqhoq-cai/**';

test.describe('homepage (logged out)', () => {
	test('renders the loading skeletons while markets are still being fetched', async ({ page }) => {
		const home = new HomePage(page);

		// Stall every Registry call so the feed stays in its skeleton state long
		// enough for a deterministic screenshot. We hold the route handler on a
		// deferred promise we explicitly release in `finally` — this avoids a
		// long-lived `setTimeout` that could outlive the test and keep the
		// Playwright worker process alive.
		let releaseStall!: () => void;
		const stalled = new Promise<void>((resolve) => {
			releaseStall = resolve;
		});

		await page.route(REGISTRY_GLOB, async (route) => {
			await stalled;
			await route.abort();
		});

		try {
			await home.goto();

			await expect(home.marketFeed).toBeVisible();
			await expect(home.signInButton).toBeVisible();

			// Pin the rendered state so the screenshot can't be accidentally
			// taken in a half-loaded transition: we expect *exactly* the three
			// MarketCardSkeletons that MarketFeed.svelte renders while loading,
			// and zero real cards. If anything leaked past the route stall,
			// `toHaveCount(0)` will fail before we write a polluted baseline.
			await expect(home.marketCardSkeleton).toHaveCount(3);
			await expect(home.marketCard).toHaveCount(0);

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

		// `marketCard.first()` only proves at least one card has rendered;
		// the remaining cards may still be streaming in. Wait for the
		// network to go idle so the snapshot captures the fully-loaded
		// feed deterministically.
		await page.waitForLoadState('networkidle');

		// "X days left" / "X hours left" drift relative to the wall clock; mask
		// every instance so the screenshot stays stable regardless of when CI ran.
		await expect(page).toHaveScreenshot('homepage-with-markets.png', {
			fullPage: true,
			mask: [home.marketTimeRemaining]
		});
	});
});
