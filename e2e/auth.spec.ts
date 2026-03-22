import { testWithII } from '@dfinity/internet-identity-playwright';
import { expect } from '@playwright/test';
import { E2E_CONFIG } from '../src/lib/constants/e2e.constants';
import { TestId } from '../src/lib/constants/test-ids.constants';
import { HomePage } from './pages/home.page';
import { LoginPage } from './pages/login.page';

testWithII.describe('Authentication Flow', () => {
	let homePage: HomePage;
	let loginPage: LoginPage;

	testWithII.beforeEach(async ({ page }) => {
		homePage = new HomePage(page);
		loginPage = new LoginPage(page);
	});

	testWithII(
		'should sign in with Internet Identity and load home page',
		async ({ page, iiPage }) => {
			// 1. Home page not loaded (showing skeletons or empty state)
			await homePage.goto();

			// Check for skeletons or empty state or cards
			// Use or to wait for any of them
			const skeletons = homePage.marketSkeletons;
			const cards = homePage.marketCards;

			// Wait for either cards or skeletons to be present
			await expect(async () => {
				const cardCount = await cards.count();
				const skeletonCount = await skeletons.count();
				expect(cardCount + skeletonCount).toBeGreaterThan(0);
			}).toPass();

			// 2. Log in with Internet Identity
			await loginPage.openLoginModal();
			const iiButton = page.getByTestId(TestId.SignInII);
			await iiButton.waitFor({ state: 'visible' });

			// Ensure II is ready (Juno emulator uses port 5987 and a specific canister ID)
			await iiPage.waitReady({
				url: E2E_CONFIG.iiUrl,
				canisterId: E2E_CONFIG.iiCanisterId
			});

			await iiPage.signIn({ passkey: { selector: `[data-tid="${TestId.SignInII}"]` } });

			// Wait for the user menu to appear, indicating successful login
			await expect(homePage.userMenuButton).toBeVisible({ timeout: 10000 });

			// 2.1 Switch to Settlement domain where we have seeded data
			await homePage.userMenuButton.click();
			await homePage.page.getByTestId(TestId.SettlementDomain).click();
			// Close the dropdown by clicking the trigger again or clicking outside
			await homePage.userMenuButton.click();

			// 3. Homepage loaded
			// Wait for skeletons to disappear and cards to appear
			await expect(skeletons.first()).not.toBeVisible();
			await expect(cards.first()).toBeVisible();

			const cardCount = await cards.count();
			expect(cardCount).toBeGreaterThan(0);

			// 4. Log out
			await homePage.logout();

			// 5. Verification: Landing page / Skeletons visible again
			await expect(skeletons.first()).toBeVisible();
			expect(await cards.count()).toBe(0);

			// Verify "Sign in" button is visible again
			await expect(loginPage.signInButton).toBeVisible();
		}
	);
});
