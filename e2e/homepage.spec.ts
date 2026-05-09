import { expect, test } from '@playwright/test';
import { HomePage } from './pages/home.page';

test.describe('homepage (logged out)', () => {
	test('renders the markets feed and the sign-in CTA', async ({ page }) => {
		const home = new HomePage(page);

		await home.goto();

		await expect(home.marketFeed).toBeVisible();
		await expect(home.signInButton).toBeVisible();

		await expect(page).toHaveScreenshot('homepage-logged-out.png', {
			fullPage: true
		});
	});
});
