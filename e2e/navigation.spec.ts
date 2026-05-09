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
 * Wait for the page chrome before screenshotting:
 *
 * 1. The routed container (`data-tid="app-main"`, set on the
 *    `{#key page.url.pathname}` div in `(app)/+layout.svelte`) has
 *    `in:fade={{ duration: 100, delay: 100 }}` on it. Playwright's
 *    `toBeVisible()` does NOT consider opacity, so without an explicit
 *    `toHaveCSS('opacity', '1')` the screenshot can be taken mid-fade
 *    and the baseline ends up half-transparent.
 * 2. The section header `<h1>` is rendered by every top-level page via
 *    `SectionHeader.svelte`, so a single locator works for all of them.
 * 3. The auth control in the navbar is the third anchor — it confirms
 *    we landed in the expected auth state.
 */
const waitForPage = async ({
	page,
	expectedLanding
}: {
	page: Page;
	expectedLanding: 'logged-out' | 'logged-in';
}) => {
	const home = new HomePage(page);

	await expect(home.appMain).toBeVisible();
	await expect(home.appMain).toHaveCSS('opacity', '1');
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
