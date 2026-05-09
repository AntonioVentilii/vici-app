import { defineConfig, devices } from '@playwright/test';

const isCI = process.env.CI === 'true';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export default defineConfig({
	testDir: 'e2e',
	testMatch: ['**/*.spec.ts'],
	timeout: FIVE_MINUTES_MS,
	expect: {
		timeout: 30_000
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
		}
	],
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		reuseExistingServer: !isCI,
		timeout: FIVE_MINUTES_MS,
		stdout: 'pipe',
		stderr: 'pipe'
	}
});
