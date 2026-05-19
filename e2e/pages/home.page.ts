import type { Locator, Page } from '@playwright/test';
import { TestId } from '../../src/lib/constants/test-ids.constants';

/**
 * Page object for the Vici home / markets feed and the public-layer
 * surfaces it routes through. The (app) layout gates every route on a
 * resolved session — anonymous visits to `/`, `/portfolio`, etc. now
 * redirect to `/signin`. The page object reflects that flow.
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
	readonly signInDevButton: Locator;
	readonly userMenu: Locator;
	readonly logoutButton: Locator;
	readonly onboardingFlow: Locator;
	readonly onboardingPrimary: Locator;
	readonly onboardingInterest: Locator;
	readonly onboardingHandleInput: Locator;

	constructor(page: Page) {
		this.page = page;
		this.appMain = page.getByTestId(TestId.AppMain);
		this.marketFeed = page.getByTestId(TestId.MarketFeed);
		this.marketCard = page.getByTestId(TestId.MarketCard);
		this.marketCardSkeleton = page.getByTestId(TestId.MarketCardSkeleton);
		this.marketTimeRemaining = page.getByTestId(TestId.MarketTimeRemaining);
		this.signInDevButton = page.getByTestId(TestId.SignInDev);
		this.userMenu = page.getByTestId(TestId.UserMenu);
		this.logoutButton = page.getByTestId(TestId.Logout);
		this.onboardingFlow = page.getByTestId(TestId.OnboardingFlow);
		this.onboardingPrimary = page.getByTestId(TestId.OnboardingPrimary);
		this.onboardingInterest = page.getByTestId(TestId.OnboardingInterest);
		this.onboardingHandleInput = page.getByTestId(TestId.OnboardingHandleInput);
	}

	async goto(): Promise<void> {
		await this.page.goto('/');
	}

	async gotoSignIn(): Promise<void> {
		await this.page.goto('/signin');
	}

	/**
	 * Pin everything that drifts between runs so {@link expect.toHaveScreenshot}
	 * compares apples to apples:
	 *
	 * - Waits for web fonts to load so glyph metrics (and therefore the height
	 *   of every text run) are stable. Without this, snapshots taken before
	 *   `document.fonts.ready` use the system fallback font and any later
	 *   run-with-fonts produces a multi-pixel diff on every character.
	 * - Replaces every `MarketTimeRemaining` chip with a fixed-width placeholder.
	 *   `getTimeRemaining()` is wall-clock-relative (`"7d 14h"`, `"0d 23h"`,
	 *   `"15m remaining"`, …); the strings have different rendered widths,
	 *   and Playwright's `mask` option overlays a magenta rectangle the size
	 *   of the element's bounding box, so even masked the rectangle width
	 *   drifts run-to-run and the diff fires. Owning the text content is the
	 *   only way to make it byte-stable.
	 * - Replaces every `PrincipalDisplay` (the shortened principal text
	 *   rendered by `CopyableAddress`) with a fixed-width placeholder.
	 *   Juno's dev mock identity is deterministic WITHIN a CI run but the
	 *   PocketIC emulator container mints a different principal on every
	 *   fresh boot, so the rendered shortened form (e.g. `aapr-r…dnh-4qe`
	 *   vs `xqzm-i…inh-4qe`) drifts run-to-run wherever a `CopyableAddress`
	 *   appears outside the (already-masked) `userMenu` — most notably on
	 *   the profile page body. Same byte-stability rationale as the time
	 *   chip: pinning the text is the only fix that doesn't trade one
	 *   variable-width drift for another.
	 *
	 * Call this immediately before any `toHaveScreenshot` in a spec that
	 * renders market cards or signed-in profile content.
	 */
	async stabilizeForSnapshot(): Promise<void> {
		await this.page.evaluate(async () => {
			await document.fonts.ready;
		});

		await this.page.evaluate(
			({ timeRemainingSel, principalSel }) => {
				for (const el of document.querySelectorAll<HTMLElement>(timeRemainingSel)) {
					el.textContent = '-- remaining';
				}

				for (const el of document.querySelectorAll<HTMLElement>(principalSel)) {
					el.textContent = 'xxxxxxx…xxxxxxx';
				}
			},
			{
				timeRemainingSel: `[data-tid="${TestId.MarketTimeRemaining}"]`,
				principalSel: `[data-tid="${TestId.PrincipalDisplay}"]`
			}
		);
	}

	/**
	 * Wait until the auth gate has settled — either we landed on a
	 * gated route (signed-in path) or we got redirected to `/signin`
	 * (signed-out path). Useful as the first await after a navigation
	 * so subsequent assertions see a stable URL.
	 */
	async waitForAuthGate(): Promise<void> {
		await this.page.waitForURL(/\/(signin|signup)?(?:\?.*)?$|\/[a-z]+/);
	}

	/**
	 * Phase 2 moved onboarding to `/signup` before authentication.
	 * Signing in through `/signin` should therefore land directly in
	 * the app shell. Keep this helper as a synchronization point for
	 * specs that still call `signInAsDevUser()` — it waits for the
	 * signed-in shell and profile hydration to settle.
	 */
	async completeOnboarding(): Promise<void> {
		await this.userMenu.waitFor({ state: 'visible' });
		await this.page.waitForLoadState('networkidle');
	}

	/**
	 * High-level helper: navigates to `/signin`, signs in via the dev
	 * mock identity, walks past the onboarding overlay, and lands on a
	 * fully-interactive signed-in app shell at `/`.
	 *
	 * Wrapped in one auto-retry with a page reload between attempts. The
	 * sign-in pipeline rides on `/api/v3|v4/canister/*` calls through the
	 * Vite dev-server proxy, which has been observed to enter a sticky
	 * `socket hang up` / `ECONNRESET` state mid-suite. Top-level Playwright
	 * retries don't help — they share the same dev-server process and the
	 * connection pool stays poisoned. A `page.reload()` opens a fresh
	 * browser context against the proxy and is often enough to recover.
	 *
	 * If the second attempt also fails, throws with the underlying error
	 * wrapped in context so it doesn't get swallowed into a generic
	 * "user-menu not visible".
	 */
	async signInAsDevUser(): Promise<void> {
		const attempt = async (): Promise<void> => {
			// `signin` is the canonical entry — direct navigation avoids
			// a redirect bounce when the test starts at a gated path.
			if (!this.page.url().includes('/signin')) {
				await this.gotoSignIn();
			}

			await this.signInDevButton.click();
			await this.completeOnboarding();
		};

		try {
			await attempt();
		} catch (firstError) {
			await this.page.reload({ waitUntil: 'networkidle' });

			try {
				await attempt();
			} catch (secondError) {
				throw new Error(
					`signInAsDevUser failed twice. ` +
						`First attempt: ${(firstError as Error).message}. ` +
						`Second attempt (after page reload): ${(secondError as Error).message}. ` +
						`This typically indicates the Vite-↔-PocketIC proxy has entered a ` +
						`sticky error state — see docs/ai/frontend/testing.md.`
				);
			}
		}
	}

	async logout(): Promise<void> {
		await this.userMenu.click();
		await this.logoutButton.click();
	}
}
