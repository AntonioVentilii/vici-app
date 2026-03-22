import type { Locator, Page } from '@playwright/test';
import { TestId } from '../../src/lib/constants/test-ids.constants';

export class HomePage {
	readonly page: Page;
	readonly marketCards: Locator;
	readonly marketSkeletons: Locator;
	readonly userMenuButton: Locator;
	readonly logoutButton: Locator;

	constructor(page: Page) {
		this.page = page;
		this.marketCards = page.getByTestId(TestId.MarketCard);
		this.marketSkeletons = page.getByTestId(TestId.MarketCardSkeleton);
		this.userMenuButton = page.getByTestId(TestId.UserMenu);
		this.logoutButton = page.getByTestId(TestId.Logout);
	}

	async goto() {
		await this.page.goto('/');
	}

	async logout() {
		await this.userMenuButton.click();
		await this.logoutButton.click();
	}

	async isLoaded() {
		// A simple check to see if we have markets or if the main section is visible
		return (await this.marketCards.count()) > 0;
	}
}
