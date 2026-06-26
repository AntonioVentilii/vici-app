import { expect, test } from '@playwright/test';
import { HomePage } from './pages/home.page';

/**
 * Friend-request inbox deep-link → Friends tab.
 *
 * A `friend_request` inbox notification routes to
 * `/arena?request=<relationId>` (`inbox.store.ts`). `ArenaPage` must force
 * the Friends tab when that param is present so the recipient lands on the
 * Accept affordance instead of whichever Arena tab they last viewed — the
 * iOS "I tapped it and nothing happened" report (#803 / #809).
 *
 * The dev mock identity mints a fresh principal per run, so seeding a real
 * incoming request between two users isn't deterministic here; this guards
 * the routing the fix adds. The full send→accept path is a manual repro in
 * the PR body (see docs/ai/frontend/testing.md).
 */

const ARENA_TAB_STORAGE_KEY = 'vici.arena-tab';

// The relation id carries a `#`; it needn't match a real request — tab
// activation keys only on the param's presence, not on a found row.
const REQUEST_KEY = 'aaaaa-aa#bbbbb-bb';

test.describe('arena friend-request deep-link (signed in)', () => {
	test('the ?request= param forces the Friends tab over the stored tab', async ({ page }) => {
		const home = new HomePage(page);

		await home.signInAsDevUser();

		// Bias the persisted tab to Leagues so a plain /arena visit would NOT
		// land on Friends — that makes the override below meaningful rather
		// than coinciding with the default.
		await page.evaluate(([key]) => localStorage.setItem(key, 'leagues'), [ARENA_TAB_STORAGE_KEY]);

		await page.goto('/arena');

		await expect(page.getByRole('tab', { name: 'Leagues' })).toHaveAttribute(
			'aria-selected',
			'true'
		);

		await page.goto(`/arena?request=${encodeURIComponent(REQUEST_KEY)}`);

		await expect(page.getByRole('tab', { name: 'Friends' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
	});
});
