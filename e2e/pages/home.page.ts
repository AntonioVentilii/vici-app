import { expect, type Locator, type Page } from '@playwright/test';
import { TestId } from '../../src/lib/constants/test-ids.constants';

/**
 * Page object for the Vici signed-in surfaces and the auth / onboarding
 * flow that reaches them.
 *
 * The (app) layout gates every route on a resolved session — anonymous
 * visits to `/app`, `/portfolio`, etc. redirect to `/signin`. Sign-in
 * itself routes a brand-new principal through the `/signup` one-screen
 * onboarding before the app shell, so the helpers below drive that flow
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
	readonly onboarding: Locator;
	readonly onboardingHandleInput: Locator;
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
		this.onboarding = page.getByTestId(TestId.Onboarding);
		this.onboardingHandleInput = page.getByTestId(TestId.OnboardingHandleInput);
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
	 * Bring the `/signup` one-screen onboarding to the point where auth can
	 * start. The empty handle field auto-claims its pool suggestion, so the
	 * provider stack ungates (the dev button becomes enabled) without any
	 * interaction — leaving the flow ready for the dev sign-in click. The
	 * "Skip" affordance is deliberately untouched: it starts guest mode, not
	 * the auth path.
	 */
	async advanceOnboardingToAuth(): Promise<void> {
		await this.onboarding.waitFor({ state: 'visible' });

		await expect(this.signInDevButton).toBeEnabled();
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
	 * High-level helper: opens `/signup`, brings the one-screen onboarding to
	 * the auth step, signs in via the dev mock identity, and lands on a fully-
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

			// The dev provider drives the same `signIn({ dev: {} })` →
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
						`sticky error state — see docs/ai/frontend/testing.md.`,
					{ cause: secondError }
				);
			}
		}
	}

	/**
	 * Hard-delete the signed-in dev principal's profile via the dev-only
	 * reset hook (`window.__viciE2E.resetMyProfile`, installed by the `(app)`
	 * layout when `isDev()`).
	 *
	 * The dev mock identity resolves to ONE principal for the whole CI run,
	 * and every prior `signInAsDevUser` auto-claims the handle field's pool
	 * suggestion and completes onboarding for it — so by the time a spec needs
	 * a brand-new user, that principal is already a fully-onboarded returning
	 * user. Delete its profile so the next sign-in bootstraps fresh, restoring
	 * the genuine new-user path.
	 *
	 * IMPORTANT: follow this with {@link signOutDev}, NOT {@link logout}. The
	 * delete must be the last signed-in action before sign-out — a signed-in
	 * page load in between (navigating to the Settings sign-out surface) re-runs
	 * `ensureProfile`, which finds no doc and immediately re-bootstraps one,
	 * resurrecting exactly what this deleted. `signOutDev` signs out in place
	 * with no navigation, so nothing re-bootstraps it.
	 */
	async resetDevProfile(): Promise<void> {
		await this.page.evaluate(async () => {
			const hooks = (window as unknown as { __viciE2E?: { resetMyProfile: () => Promise<void> } })
				.__viciE2E;

			if (!hooks) {
				throw new Error(
					'Dev-only e2e reset hook (window.__viciE2E) is not installed — expected isDev() on the dev server.'
				);
			}

			await hooks.resetMyProfile();
		});
	}

	/**
	 * Durably clear the persisted session and sign out via the dev-only hook
	 * (Juno `signOut`), without navigating to the Settings sign-out surface.
	 * Pairs with {@link resetDevProfile}: no signed-in page load happens between
	 * the delete and the sign-out, so `ensureProfile` can't re-bootstrap the
	 * deleted profile.
	 *
	 * Ordering is load-bearing and everything runs in ONE evaluate on the
	 * current `/flow` page:
	 *
	 * - The hook is installed by the `(app)` layout, so it only exists on `(app)`
	 *   routes — NOT on `/signin`. And `signOut()` fires `onAuthStateChange(null)`,
	 *   which the auth gate follows with a full reload to `/signin`. So the clear
	 *   MUST happen before `signOut()`, while we're still on `/flow` with the hook
	 *   present and the page stable — clearing afterwards would land on `/signin`
	 *   (no hook) or race the reload ("Execution context was destroyed").
	 * - `clearSession()` wipes the delegation from IndexedDB; `signOut()` is last
	 *   and bare, so the evaluate resolves before its reload commits.
	 *
	 * The caller then awaits the `/signin` redirect before `goto('/signup')`.
	 */
	async signOutDev(): Promise<void> {
		await this.page.evaluate(async () => {
			const hooks = (
				window as unknown as {
					__viciE2E?: { signOut: () => Promise<void>; clearSession: () => Promise<void> };
				}
			).__viciE2E;

			if (!hooks) {
				throw new Error(
					'Dev-only e2e reset hook (window.__viciE2E) is not installed — expected isDev() on the dev server.'
				);
			}

			await hooks.clearSession();
			await hooks.signOut();
		});
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
