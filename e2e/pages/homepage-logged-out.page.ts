import { expect, type Page } from '@playwright/test';
import { HomePage } from './home.page';

export interface HomepageLoggedOutOptions {
	page: Page;
}

/**
 * Logged-out home view: markets shell visible, no auth.
 */
export class HomepageLoggedOut {
	private readonly homePage: HomePage;

	constructor(private readonly options: HomepageLoggedOutOptions) {
		this.homePage = new HomePage(options.page);
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
	}

	async takeScreenshot() {
		await expect(this.options.page).toHaveScreenshot();
	}
}
