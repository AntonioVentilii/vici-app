import type { Locator, Page } from '@playwright/test';
import { TestId } from '../../src/lib/constants/test-ids.constants';

export class LoginPage {
	readonly page: Page;
	readonly signInButton: Locator;
	readonly signInDevButton: Locator;
	readonly signInIIButton: Locator;

	constructor(page: Page) {
		this.page = page;
		this.signInButton = page.getByTestId(TestId.SignInButton);
		this.signInDevButton = page.getByTestId(TestId.SignInDev);
		this.signInIIButton = page.getByTestId(TestId.SignInII);
	}

	async goto() {
		await this.page.goto('/');
	}

	async openLoginModal() {
		await this.signInButton.click();
	}

	async loginWithDev() {
		await this.openLoginModal();
		await this.signInDevButton.waitFor({ state: 'visible' });
		await this.signInDevButton.click();
	}

	async loginWithII() {
		await this.openLoginModal();
		await this.signInIIButton.waitFor({ state: 'visible' });
		await this.signInIIButton.click();
	}
}
