import { expect, test, type Page } from '@playwright/test';
import { HomePage } from './pages/home.page';

/**
 * Top-level navigation smoke tests. For each app page (except `/flow`,
 * which is intentionally excluded), navigate, wait for the page header
 * to render, and snapshot. We exercise both the logged-out variant
 * (some pages render a public view, some render an in-page sign-in
 * prompt) and the dev-signed-in variant (which gets the user-scoped
 * version). Markets / home is covered by `homepage.spec.ts`.
 */
const PAGES = [
	{ name: 'leaderboard', path: '/leaderboard' },
	{ name: 'portfolio', path: '/portfolio' },
	{ name: 'profile', path: '/profile' },
	{ name: 'wallet', path: '/wallet' }
] as const;

/**
 * Wait for the page chrome (h1 in the section header + the auth control
 * in the right of the navbar) before screenshotting. The section header
 * is rendered by `SectionHeader.svelte` which every top-level page
 * mounts, so a single locator works for all of them.
 */
const waitForPage = async ({
	page,
	expectedLanding
}: {
	page: Page;
	expectedLanding: 'logged-out' | 'logged-in';
}) => {
	const home = new HomePage(page);

	await expect(page.locator('h1').first()).toBeVisible();

	if (expectedLanding === 'logged-out') {
		await expect(home.signInButton).toBeVisible();
	} else {
		await expect(home.userMenu).toBeVisible();
	}
};

test.describe('navigation (logged out)', () => {
	for (const { name, path } of PAGES) {
		test(`renders ${path}`, async ({ page }) => {
			const home = new HomePage(page);

			await page.goto(path);
			await waitForPage({ page, expectedLanding: 'logged-out' });

			// The market-time-remaining chip drifts vs. the wall clock; mask
			// every instance so screenshots stay stable run-to-run. Pages
			// that don't render any are no-ops for the mask.
			await expect(page).toHaveScreenshot(`navigation-${name}-logged-out.png`, {
				fullPage: true,
				mask: [home.marketTimeRemaining]
			});
		});
	}
});

test.describe('navigation (signed in)', () => {
	test.beforeEach(async ({ page }) => {
		const home = new HomePage(page);
		await home.goto();
		await home.openSignInModal();
		await home.signInDevButton.click();

		await expect(home.userMenu).toBeVisible();
	});

	for (const { name, path } of PAGES) {
		test(`renders ${path}`, async ({ page }) => {
			const home = new HomePage(page);

			await page.goto(path);
			await waitForPage({ page, expectedLanding: 'logged-in' });

			// Mask the user-menu (random principal each run) and any
			// time-remaining chips on the page.
			await expect(page).toHaveScreenshot(`navigation-${name}-logged-in.png`, {
				fullPage: true,
				mask: [home.userMenu, home.marketTimeRemaining]
			});
		});
	}
});
