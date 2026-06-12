import { isNullish } from '@dfinity/utils';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { TestId } from '../src/lib/constants/test-ids.constants';
import { HomePage } from './pages/home.page';

const drag = async ({
	page,
	target,
	deltaX,
	deltaY
}: {
	page: Page;
	target: Locator;
	deltaX: number;
	deltaY: number;
}): Promise<void> => {
	const box = await target.boundingBox();

	expect(box).not.toBeNull();

	if (isNullish(box)) {
		throw new Error('Cannot drag onboarding target: missing bounding box.');
	}

	const startX = box.x + box.width / 2;
	const startY = box.y + box.height / 2;

	await page.mouse.move(startX, startY);
	await page.mouse.down();
	await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 8 });
	await page.mouse.up();
};

test.describe('pre-sign-in onboarding', () => {
	test('collects starter pack details and applies them after dev sign-in', async ({ page }) => {
		const home = new HomePage(page);

		await page.goto('/signup');

		await expect(home.onboardingFlow).toBeVisible();

		await drag({
			page,
			target: page.getByTestId(TestId.OnboardingFirstCallCard),
			deltaX: 180,
			deltaY: 0
		});

		await expect(page.getByTestId(TestId.OnboardingPracticeCard)).toBeVisible();

		// Step 2 requires both tap-to-reveal and skip practice before the
		// primary action appears.
		await page.getByTestId(TestId.OnboardingPracticeCard).click();
		await page.getByTestId(TestId.OnboardingPracticeCard).click();
		await drag({
			page,
			target: page.getByTestId(TestId.OnboardingPracticeCard),
			deltaX: 0,
			deltaY: -180
		});

		await expect(page.getByTestId(TestId.OnboardingPrimary)).toBeVisible();

		await page.getByTestId(TestId.OnboardingPrimary).click();

		const interests = page.getByTestId(TestId.OnboardingInterest);

		await expect(interests).toHaveCount(6);

		await interests.nth(0).click();
		await interests.nth(1).click();
		await interests.nth(2).click();
		await page.getByTestId(TestId.OnboardingPrimary).click();

		await page.getByTestId(TestId.OnboardingHandleInput).fill('tacitus');
		await page.getByTestId(TestId.OnboardingEmailInput).fill('tacitus@example.com');
		await page.getByTestId(TestId.OnboardingPrimary).click();

		await page.waitForURL('**/signin');

		await expect(page.getByText('Starter pack ready')).toBeVisible();

		await home.signInAsDevUser();

		await expect(home.userMenu).toBeVisible();

		await page.goto('/profile');

		await expect(home.appMain.locator('h1').filter({ hasText: 'tacitus' })).toBeVisible();
	});
});
