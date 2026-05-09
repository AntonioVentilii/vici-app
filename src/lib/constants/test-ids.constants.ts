/**
 * Test IDs for end-to-end tests.
 *
 * Components that need to be addressable from Playwright should get a
 * `data-tid={TestId.X}` attribute. Playwright is configured with
 * `testIdAttribute: 'data-tid'` (see `playwright.config.ts`), so tests can
 * use `page.getByTestId(TestId.X)`.
 *
 * Keep this enum minimal — only add an entry when an E2E test references it.
 * See `docs/ai/frontend/testing.md` for the broader testing policy.
 */
export enum TestId {
	SignInButton = 'sign-in-button',
	SignInII = 'sign-in-ii',
	UserMenu = 'user-menu',
	Logout = 'logout',
	MarketFeed = 'market-feed'
}
