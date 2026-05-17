import { defineConfig, devices } from '@playwright/test';

const isCI = process.env.CI === 'true';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export default defineConfig({
	testDir: 'e2e',
	testMatch: ['**/*.spec.ts'],
	timeout: FIVE_MINUTES_MS,
	snapshotDir: 'e2e/snapshots',
	expect: {
		timeout: 30_000,
		toHaveScreenshot: {
			// Tolerate sub-pixel rendering / font-hinting differences; the diff
			// still shows up clearly enough for review while not red-ing CI on
			// a 1-pixel anti-aliasing change.
			threshold: 0.3,
			// Disable CSS animations so spinner / skeleton frames don't drift.
			animations: 'disabled',
			// Hide caret to keep input snapshots stable.
			caret: 'hide'
		}
	},
	fullyParallel: false,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	workers: 1,
	reporter: isCI ? [['html'], ['list']] : 'list',
	use: {
		baseURL: 'http://localhost:5173',
		testIdAttribute: 'data-tid',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		actionTimeout: 30_000,
		navigationTimeout: 60_000
	},
	projects: [
		{
			name: 'chromium',
			use: devices['Desktop Chrome']
		},
		// Small Samsung Galaxy: tests narrow-mobile layouts (320 CSS px wide is
		// the narrowest viewport real users hit on modern Android). Both screen
		// and viewport are pinned explicitly so any future Playwright bump to
		// the bundled device profile can't silently re-baseline the snapshots.
		{
			name: 'Galaxy S9+',
			use: {
				...devices['Galaxy S9+'],
				screen: { width: 320, height: 658 },
				viewport: { width: 320, height: 658 }
			}
		},
		// Big Samsung Galaxy: tests roomy-mobile layouts (480 CSS px wide is
		// the widest non-tablet Galaxy profile Playwright ships, and still
		// below Tailwind's `md` breakpoint at 768px so the `MobileNav` is in
		// effect — that's the variant we actually want covered).
		{
			name: 'Galaxy A55',
			use: {
				...devices['Galaxy A55'],
				screen: { width: 480, height: 1040 },
				viewport: { width: 480, height: 1040 }
			}
		}
	],
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		reuseExistingServer: !isCI,
		timeout: FIVE_MINUTES_MS,
		stdout: 'pipe',
		stderr: 'pipe',
		env: {
			// Point juno.config.ts at the emulator satellite (see juno.config.ts).
			JUNO_EMULATOR: 'true'
		}
	}
});
