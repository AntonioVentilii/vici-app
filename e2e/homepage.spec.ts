import { testWithII } from '@dfinity/internet-identity-playwright';
import { test } from '@playwright/test';
import { E2E_CONFIG } from '../src/lib/constants/e2e.constants';
import { HomepageLoggedIn } from './pages/homepage-logged-in.page';
import { HomepageLoggedOut } from './pages/homepage-logged-out.page';

test('should display homepage in logged out state', async ({ page }) => {
	const homepageLoggedOut = new HomepageLoggedOut({ page });

	await homepageLoggedOut.waitForReady();

	await homepageLoggedOut.takeScreenshot();
});

testWithII.describe('Homepage (signed in)', () => {
	testWithII.beforeEach(async ({ iiPage }) => {
		await iiPage.waitReady({
			url: E2E_CONFIG.iiUrl,
			canisterId: E2E_CONFIG.iiCanisterId
		});
	});

	testWithII(
		'should display homepage in logged in state',
		async ({ page, iiPage }) => {
			const isMobile = (page.viewportSize()?.width ?? 0) < 768;
			const homepageLoggedIn = new HomepageLoggedIn({ page, iiPage, isMobile });

			await homepageLoggedIn.waitForReady();

			await homepageLoggedIn.takeScreenshot();
		}
	);
});
