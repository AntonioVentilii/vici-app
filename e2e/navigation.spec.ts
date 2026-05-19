import { expect, test, type Page } from '@playwright/test';
import { HomePage } from './pages/home.page';

/**
 * Top-level navigation smoke tests.
 *
 * Phase 1 routing change: every (app) path is auth-gated. Anonymous
 * navigation to a gated path bounces to `/signin`. Signed-in users see
 * the page chrome as before. We exercise:
 *
 * - One redirect-from-anonymous test per gated path, so a regression
 *   in the gate (e.g. the redirect getting deleted) fails loud.
 * - The signed-in variant for each non-Flow page, snapshotted so a
 *   structural drift on the page surfaces in CI.
 *
 * Markets / home is covered by `homepage.spec.ts`.
 */
const PAGES = [
	{ name: 'leaderboard', path: '/leaderboard' },
	{ name: 'portfolio', path: '/portfolio' },
	{ name: 'profile', path: '/profile' },
	{ name: 'wallet', path: '/wallet' }
] as const;

/**
 * Wait for the page chrome AND every initial data fetch to settle before
 * screenshotting:
 *
 * 1. The routed container (`data-tid="app-main"`, set on the
 *    `{#key page.url.pathname}` div in `(app)/+layout.svelte`) has
 *    `in:fade={{ duration: 100, delay: 100 }}` on it. Playwright's
 *    `toBeVisible()` propagates parent opacity — so until we wait for
 *    `opacity: '1'`, every descendant (including the page's `<h1>`) is
 *    considered hidden.
 * 2. The section header `<h1>` is rendered by every top-level page via
 *    `SectionHeader.svelte`. We scope the lookup to `appMain` because
 *    `SignInModal.svelte` ALSO renders an `<h1>` inside its `<dialog>`,
 *    which lives in the DOM even when the dialog is closed — a global
 *    `page.locator('h1').first()` picks that hidden h1 first.
 * 3. The user-menu confirms we landed in the signed-in auth state.
 * 4. `networkidle` waits until there's been no network activity for
 *    500ms, which lets every page's `onMount` data fetch (Leaderboard's
 *    `getLeaderboard`, Portfolio's `getPositions` + `getUserTradeHistory`,
 *    Wallet's `reloadHistory`, Profile's friends / groups / activity
 *    sub-loaders, etc.) finish rendering before the screenshot — without
 *    this, the snapshot races the data fetch and ping-pongs between
 *    "Calculating Alphas…" spinners and the loaded view, which is what
 *    was causing CI to auto-commit a different baseline on every re-run.
 *    The repo has no <5s polling on any test page (Leaderboard refreshes
 *    every 30s, Profile every 60s), so 500ms idle is reliably reachable.
 */
const waitForSignedInPage = async ({ page }: { page: Page }): Promise<void> => {
	const home = new HomePage(page);

	await expect(home.appMain).toBeVisible();
	await expect(home.appMain).toHaveCSS('opacity', '1');
	await expect(home.appMain.locator('h1').first()).toBeVisible();
	await expect(home.userMenu).toBeVisible();

	await page.waitForLoadState('networkidle');
};

test.describe('navigation (anonymous → redirected to signin)', () => {
	for (const { path } of PAGES) {
		test(`anonymous visit to ${path} redirects to /signin`, async ({ page }) => {
			await page.goto(path);

			// The auth gate fires once `userSignedOutResolved` flips true,
			// which can take a tick after the initial mount. `waitForURL`
			// gives it room to settle.
			await page.waitForURL('**/signin');

			expect(new URL(page.url()).pathname).toBe('/signin');
		});
	}
});

test.describe('navigation (signed in)', () => {
	test.beforeEach(async ({ page }) => {
		const home = new HomePage(page);
		await home.signInAsDevUser();

		await expect(home.userMenu).toBeVisible();
	});

	for (const { name, path } of PAGES) {
		test(`renders ${path}`, async ({ page }) => {
			const home = new HomePage(page);

			await page.goto(path);
			await waitForSignedInPage({ page });

			// Mask only the user-menu: dev sign-in mints a fresh principal
			// per run, so the avatar genuinely differs.
			await home.stabilizeForSnapshot();

			await expect(page).toHaveScreenshot(`navigation-${name}-logged-in.png`, {
				fullPage: true,
				mask: [home.userMenu]
			});
		});
	}
});
