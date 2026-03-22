import { testWithII } from '@dfinity/internet-identity-playwright';
import { expect } from '@playwright/test';

testWithII('should display homepage in logged out state', async ({ page }) => {
	await page.goto('/');

	expect(page).toHaveScreenshot();
});
