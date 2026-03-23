import type { InternetIdentityPage } from '@dfinity/internet-identity-playwright';
import { expect, type Page } from '@playwright/test';
import { TestId } from '../../src/lib/constants/test-ids.constants';
import { HomePage } from './home.page';
import { LoginPage } from './login.page';

export interface HomepageLoggedInOptions {
	page: Page;
	iiPage: InternetIdentityPage;
	isMobile?: boolean;
}

export class HomepageLoggedIn {
	readonly isMobile: boolean;

	private readonly homePage: HomePage;
	private readonly loginPage: LoginPage;

	constructor(private readonly options: HomepageLoggedInOptions) {
		this.isMobile = options.isMobile ?? false;
		this.homePage = new HomePage(options.page);
		this.loginPage = new LoginPage(options.page);
	}

	async waitForReady() {
		await this.homePage.goto();

		const skeletons = this.homePage.marketSkeletons;
		const cards = this.homePage.marketCards;

		await expect(async () => {
			const cardCount = await cards.count();
			const skeletonCount = await skeletons.count();

			expect(cardCount + skeletonCount).toBeGreaterThan(0);
		}).toPass();

		await this.loginPage.openLoginModal();
		await this.options.page.getByTestId(TestId.SignInII).waitFor({ state: 'visible' });

		await this.options.iiPage.signIn({
			passkey: { selector: `[data-tid="${TestId.SignInII}"]` }
		});

		await expect(this.homePage.userMenuButton).toBeVisible({ timeout: 15_000 });
		await expect(cards.first()).toBeVisible({ timeout: 15_000 });
	}

	async takeScreenshot() {
		await expect(this.options.page).toHaveScreenshot();
	}
}
