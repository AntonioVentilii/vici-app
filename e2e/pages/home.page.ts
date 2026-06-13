import { isNullish } from '@dfinity/utils';
import type { Locator, Page } from '@playwright/test';
import { TestId } from '../../src/lib/constants/test-ids.constants';

/**
 * Page object for the Vici signed-in surfaces and the auth / onboarding
 * flow that reaches them.
 *
 * The (app) layout gates every route on a resolved session — anonymous
 * visits to `/app`, `/portfolio`, etc. redirect to `/signin`. Sign-in
 * itself routes a brand-new principal through the `/signup` onboarding
 * beats before the app shell, so the helpers below drive that flow
 * end-to-end rather than expecting a bare sign-in to land in the app.
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
	/**
	 * The signed-in account control. The desktop top-nav profile handle and
	 * the mobile pillnav profile tab both carry `data-tid="user-menu"`, and
	 * exactly one is visible per viewport (the other is `display:none` at
	 * its breakpoint), so the `:visible` filter resolves to a single match
	 * on both the `chromium` (desktop) and `Galaxy *` (mobile) projects.
	 */
	readonly userMenu: Locator;
	readonly signOutButton: Locator;
	readonly logoutButton: Locator;
	readonly onboardingFlow: Locator;
	readonly onboardingTeamSkip: Locator;
	readonly onboardingCard: Locator;
	readonly onboardingHandleSkip: Locator;
	readonly onboardingPrimary: Locator;

	constructor(page: Page) {
		this.page = page;
		this.appMain = page.getByTestId(TestId.AppMain);
		this.marketFeed = page.getByTestId(TestId.MarketFeed);
		this.marketCard = page.getByTestId(TestId.MarketCard);
		this.marketCardSkeleton = page.getByTestId(TestId.MarketCardSkeleton);
		this.marketTimeRemaining = page.getByTestId(TestId.MarketTimeRemaining);
		this.signInDevButton = page.getByTestId(TestId.SignInDev);
		this.userMenu = page.locator(`[data-tid="${TestId.UserMenu}"]:visible`);
		this.signOutButton = page.getByTestId(TestId.SignOutButton);
		this.logoutButton = page.getByTestId(TestId.Logout);
		this.onboardingFlow = page.getByTestId(TestId.OnboardingFlow);
		this.onboardingTeamSkip = page.getByTestId(TestId.OnboardingTeamSkip);
		this.onboardingCard = page.getByTestId(TestId.OnboardingCard);
		this.onboardingHandleSkip = page.getByTestId(TestId.OnboardingHandleSkip);
		this.onboardingPrimary = page.getByTestId(TestId.OnboardingPrimary);
	}

	async goto(): Promise<void> {
		await this.page.goto('/');
	}

	/**
	 * The markets board. The root landing (`/`) bounces a signed-in session
	 * to `/flow`; the markets list lives on the canonical home surface at
	 * `/app` (`AppPath.Home`), which is what the feed snapshots target.
	 */
	async gotoMarkets(): Promise<void> {
		await this.page.goto('/app');
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
	 * Swipe the Beat 1.b first-call card to the right to commit a YES call.
	 * The card has no button — the only way to advance is a pointer drag
	 * past the component's 80px commit threshold — so we drive a mouse
	 * gesture from the card centre well past it.
	 */
	async commitFirstCall(): Promise<void> {
		await this.onboardingCard.waitFor({ state: 'visible' });

		// Dismiss the one-time gesture coach (`FlowCoach`) up front. Its
		// overlay is `pointer-events: none`, but its centred caption is
		// `pointer-events: auto` and sits exactly over the card centre, so a
		// centre-anchored pointer-down would land on the caption instead of
		// the card. Escape dismisses it; it's a no-op once already gone.
		await this.page.keyboard.press('Escape');

		const box = await this.onboardingCard.boundingBox();

		if (isNullish(box)) {
			throw new Error('Onboarding first-call card has no bounding box to swipe.');
		}

		// Anchor the swipe in the lower third — clear of the (centred) coach
		// caption and of any interactive target, on the card's plain body —
		// then drag right well past the component's 80px commit threshold.
		const startX = box.x + box.width / 2;
		const startY = box.y + box.height * 0.72;

		await this.page.mouse.move(startX, startY);
		await this.page.mouse.down();
		await this.page.mouse.move(startX + 220, startY, { steps: 12 });
		await this.page.mouse.up();
	}

	/**
	 * Walk the `/signup` onboarding beats up to (but not including) the auth
	 * step, taking the fastest path: skip the team picker (Beat 1.a), swipe
	 * the derived first-call card (Beat 1.b), then skip the handle picker
	 * (Beat 2). Leaves the flow on Beat 3 with the provider stack mounted.
	 */
	async advanceOnboardingToAuth(): Promise<void> {
		await this.onboardingFlow.waitFor({ state: 'visible' });

		await this.onboardingTeamSkip.click();
		await this.commitFirstCall();
		await this.onboardingHandleSkip.click();

		await this.signInDevButton.waitFor({ state: 'visible' });
	}

	/**
	 * Wait until the signed-in app shell has settled — the account control
	 * is visible and the initial data fetches have gone idle. Useful as the
	 * first await after a sign-in so subsequent assertions see a stable
	 * shell rather than racing hydration.
	 */
	async waitForSignedInShell(): Promise<void> {
		await this.userMenu.waitFor({ state: 'visible' });

		// Best-effort settle: the account control being visible already proves
		// the signed-in shell mounted. `networkidle` is bounded and its
		// timeout swallowed because the landing surface (`/flow`) runs
		// background polling (order books) that can keep the network from ever
		// going fully idle — without the bound this would hang the full
		// `actionTimeout` on every sign-in.
		try {
			await this.page.waitForLoadState('networkidle', { timeout: 5_000 });
		} catch (err) {
			if (!(err instanceof Error) || err.name !== 'TimeoutError') {
				throw err;
			}
		}
	}

	/**
	 * High-level helper: opens `/signup`, walks the onboarding beats, signs
	 * in via the dev mock identity at Beat 3, and lands on a fully-
	 * interactive signed-in shell (`/flow`). A fresh dev principal has no
	 * profile, so this new-user path is the canonical way into the app — a
	 * bare sign-in on `/signin` would itself bounce here.
	 *
	 * Wrapped in one auto-retry with a page reload between attempts. The
	 * sign-in pipeline rides on `/api/v3|v4/canister/*` calls through the
	 * Vite dev-server proxy, which has been observed to enter a sticky
	 * `socket hang up` / `ECONNRESET` state mid-suite. Top-level Playwright
	 * retries don't help — they share the same dev-server process and the
	 * connection pool stays poisoned. A `page.reload()` re-runs app init
	 * against the proxy and is often enough to shake it loose.
	 *
	 * If the second attempt also fails, throws with the underlying error
	 * wrapped in context so it doesn't get swallowed into a generic
	 * "user-menu not visible".
	 */
	async signInAsDevUser(): Promise<void> {
		const attempt = async (): Promise<void> => {
			await this.page.goto('/signup');

			await this.advanceOnboardingToAuth();

			// Beat 3's dev provider drives the same `signIn({ dev: {} })` →
			// `onAuthStateChange` pipeline as the /signin gate; on success the
			// onboarding handoff is drained and the app hard-loads `/flow`.
			await this.signInDevButton.click();

			await this.waitForSignedInShell();
		};

		try {
			await attempt();
		} catch (firstError: unknown) {
			// `domcontentloaded`, not `networkidle`: the signed-in surfaces run
			// background polling that can keep the network from ever going
			// idle, which would hang the retry instead of recovering it.
			await this.page.reload({ waitUntil: 'domcontentloaded' });

			try {
				await attempt();
			} catch (secondError: unknown) {
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

	/**
	 * Sign out via the Settings page — the only sign-out surface in the
	 * current app (the old account dropdown is gone). The reveal button
	 * arms an in-page confirm; the destructive confirm calls `signOut()`,
	 * after which the (app) gate routes back to `/signin`.
	 */
	async logout(): Promise<void> {
		await this.page.goto('/settings');
		await this.signOutButton.click();
		await this.logoutButton.click();
	}
}
