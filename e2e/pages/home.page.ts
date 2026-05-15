import { expect, type Locator, type Page } from '@playwright/test';
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
	readonly onboardingFlow: Locator;
	readonly onboardingPrimary: Locator;
	readonly onboardingInterest: Locator;
	readonly onboardingArchetype: Locator;
	readonly onboardingHandleInput: Locator;

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
		this.onboardingFlow = page.getByTestId(TestId.OnboardingFlow);
		this.onboardingPrimary = page.getByTestId(TestId.OnboardingPrimary);
		this.onboardingInterest = page.getByTestId(TestId.OnboardingInterest);
		this.onboardingArchetype = page.getByTestId(TestId.OnboardingArchetype);
		this.onboardingHandleInput = page.getByTestId(TestId.OnboardingHandleInput);
	}

	async goto(): Promise<void> {
		await this.page.goto('/');
	}

	async openSignInModal(): Promise<void> {
		await this.signInButton.click();
	}

	/**
	 * Clicks through the 5-step OnboardingFlow with deterministic choices so
	 * the rest of the suite can interact with the signed-in app shell. Dev
	 * sign-in mints a fresh principal each run, which always lands on a
	 * profile with no archetype, which always shows the onboarding overlay
	 * (`fixed inset-0 z-50` — intercepts every click underneath). Without
	 * dismissing it, even a `userMenu.click()` would time out.
	 */
	async completeOnboarding(): Promise<void> {
		await expect(this.onboardingFlow).toBeVisible();

		// Step 0: welcome.
		await this.onboardingPrimary.click();

		// Step 1: swipe tutorial.
		await this.onboardingPrimary.click();

		// Step 2: pick 3 interests (the minimum required to advance).
		const interests = this.onboardingInterest;

		await expect(interests).toHaveCount(6);

		for (let i = 0; i < 3; i++) {
			await interests.nth(i).click();
		}

		await this.onboardingPrimary.click();

		// Step 3: pick the first archetype.
		await this.onboardingArchetype.first().click();
		await this.onboardingPrimary.click();

		// Step 4: claim a handle and finish. The placeholder ("tacitus") is
		// not auto-filled, so the input must be typed into explicitly.
		await this.onboardingHandleInput.fill('tacitus');
		await this.onboardingPrimary.click();

		await expect(this.onboardingFlow).toBeHidden();
	}

	/**
	 * High-level helper: opens the sign-in modal, signs in via the dev mock
	 * identity, and walks past the onboarding overlay so the caller lands
	 * on a fully-interactive signed-in app shell.
	 */
	async signInAsDevUser(): Promise<void> {
		await this.openSignInModal();
		await this.signInDevButton.click();
		await this.completeOnboarding();
	}

	async logout(): Promise<void> {
		await this.userMenu.click();
		await this.logoutButton.click();
	}
}
