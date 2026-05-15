import type { Locator, Page } from '@playwright/test';
import { TestId } from '../../src/lib/constants/test-ids.constants';

/**
 * Page object for the Vici home / markets feed.
 *
 * Tests should prefer this object over reaching into selectors so that
 * structural changes only have to be reflected in one place.
 */
export class HomePage {
	readonly page: Page;
	readonly appMain: Locator;
	readonly marketFeed: Locator;
	readonly marketCard: Locator;
	readonly marketCardSkeleton: Locator;
	readonly marketTimeRemaining: Locator;
	readonly signInButton: Locator;
	readonly signInDevButton: Locator;
	readonly userMenu: Locator;
	readonly logoutButton: Locator;

	constructor(page: Page) {
		this.page = page;
		this.appMain = page.getByTestId(TestId.AppMain);
		this.marketFeed = page.getByTestId(TestId.MarketFeed);
		this.marketCard = page.getByTestId(TestId.MarketCard);
		this.marketCardSkeleton = page.getByTestId(TestId.MarketCardSkeleton);
		this.marketTimeRemaining = page.getByTestId(TestId.MarketTimeRemaining);
		this.signInButton = page.getByTestId(TestId.SignInButton);
		this.signInDevButton = page.getByTestId(TestId.SignInDev);
		this.userMenu = page.getByTestId(TestId.UserMenu);
		this.logoutButton = page.getByTestId(TestId.Logout);
	}

	async goto(): Promise<void> {
		await this.page.goto('/');
	}

	async openSignInModal(): Promise<void> {
		await this.signInButton.click();
	}

	async logout(): Promise<void> {
		await this.userMenu.click();
		await this.logoutButton.click();
	}
}
