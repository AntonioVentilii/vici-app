import { testWithII } from '@dfinity/internet-identity-playwright';
import { expect } from '@playwright/test';
import { TestId } from '../src/lib/constants/test-ids.constants';
import { E2E_CONFIG } from './config';
import { HomePage } from './pages/home.page';

testWithII.describe('authentication (Internet Identity)', () => {
	testWithII.beforeEach(async ({ iiPage }) => {
		await iiPage.waitReady({
			url: E2E_CONFIG.iiUrl,
			canisterId: E2E_CONFIG.iiCanisterId,
			timeout: E2E_CONFIG.iiReadyTimeoutMs
		});
	});

	testWithII('signs in with a fresh passkey and signs out again', async ({ page, iiPage }) => {
		const home = new HomePage(page);

		await home.goto();

		await expect(home.signInButton).toBeVisible();

		await home.openSignInModal();

		await iiPage.signIn({
			passkey: { selector: `[data-tid="${TestId.SignInII}"]` }
		});

		await expect(home.userMenu).toBeVisible();
		await expect(home.signInButton).not.toBeVisible();

		await home.logout();

		await expect(home.signInButton).toBeVisible();
		await expect(home.userMenu).not.toBeVisible();
	});
});
