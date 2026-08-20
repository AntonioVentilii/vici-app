// The beta access gate limits sign-in to an admin-managed email allowlist
// while enabled. These suites pin the valve's semantics: absent or disabled
// means everyone passes, an enabled gate admits exactly the allowlist
// (case-insensitively) and refuses everyone else with the stable
// `beta_closed` wire error, on both the OTP flow and the OAuth callback.

import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	spyOn,
	test
} from 'bun:test';
import { deleteAppSetting, upsertAppSetting } from '../src/admin/settings';
import { BETA_GATE_SETTING_KEY, isBetaSignInAllowed } from '../src/auth/beta-gate';
import * as google from '../src/auth/google';
import { encodeOauthState } from '../src/auth/oauth-state';
import { createOtp } from '../src/auth/otp';
import { env } from '../src/env';
import { app } from '../src/index';
import { OAUTH_STATE_COOKIE } from '../src/lib/cookie';
import { resetRateLimits } from '../src/lib/rate-limit';
import { ensureMigrated, uniqueEmail } from './helpers/auth';
import { dbAvailable } from './helpers/setup';

const setGate = (value: unknown): Promise<unknown> =>
	upsertAppSetting({ key: BETA_GATE_SETTING_KEY, value });

const clearGate = (): Promise<unknown> => deleteAppSetting(BETA_GATE_SETTING_KEY);

const otpRequest = (email: string): Promise<Response> =>
	app.handle(
		new Request('http://localhost/api/v1/auth/otp/request', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email })
		})
	);

const otpVerify = ({ email, code }: { email: string; code: string }): Promise<Response> =>
	app.handle(
		new Request('http://localhost/api/v1/auth/otp/verify', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email, code })
		})
	);

describe.if(dbAvailable)('beta gate policy', () => {
	beforeAll(async () => {
		await ensureMigrated();
	});

	afterEach(async () => {
		await clearGate();
	});

	test('absent setting: everyone passes', async () => {
		expect(await isBetaSignInAllowed(uniqueEmail())).toBe(true);
	});

	test('enabled=false: everyone passes regardless of the allowlist', async () => {
		await setGate({ enabled: false, emails: [] });

		expect(await isBetaSignInAllowed(uniqueEmail())).toBe(true);
	});

	test('enabled gate admits allowlisted addresses case-insensitively', async () => {
		const email = uniqueEmail();

		await setGate({ enabled: true, emails: [` ${email.toUpperCase()} `] });

		expect(await isBetaSignInAllowed(email)).toBe(true);
		expect(await isBetaSignInAllowed(email.toUpperCase())).toBe(true);
		expect(await isBetaSignInAllowed(uniqueEmail())).toBe(false);
	});

	test('malformed setting fails closed while enabled', async () => {
		await setGate({ enabled: true });

		expect(await isBetaSignInAllowed(uniqueEmail())).toBe(false);

		await setGate({ enabled: true, emails: 'not-a-list' });

		expect(await isBetaSignInAllowed(uniqueEmail())).toBe(false);
	});
});

describe.if(dbAvailable)('beta gate on the OTP flow', () => {
	beforeAll(async () => {
		await ensureMigrated();
	});

	beforeEach(() => {
		resetRateLimits();
	});

	afterEach(async () => {
		await clearGate();
	});

	test('gate off (absent): request succeeds for any address', async () => {
		const res = await otpRequest(uniqueEmail());

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});

	test('gate disabled: request succeeds for a non-allowlisted address', async () => {
		await setGate({ enabled: false, emails: [uniqueEmail()] });

		const res = await otpRequest(uniqueEmail());

		expect(res.status).toBe(200);
	});

	test('allowlisted address passes the enabled gate', async () => {
		const email = uniqueEmail();

		await setGate({ enabled: true, emails: [email] });

		const res = await otpRequest(email);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});

	test('allowlist matching ignores case on both sides', async () => {
		const email = uniqueEmail();

		await setGate({ enabled: true, emails: [email.toUpperCase()] });

		const res = await otpRequest(email);

		expect(res.status).toBe(200);
	});

	test('non-allowlisted request is refused with the stable beta_closed error', async () => {
		await setGate({ enabled: true, emails: [uniqueEmail()] });

		const res = await otpRequest(uniqueEmail());

		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: 'beta_closed' });
	});

	test('a code issued before the gate flipped on cannot verify', async () => {
		const email = uniqueEmail();
		const code = await createOtp(email);

		await setGate({ enabled: true, emails: [uniqueEmail()] });

		const res = await otpVerify({ email, code });

		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: 'beta_closed' });
		expect(res.headers.get('set-cookie')).toBeNull();
	});

	test('allowlisted verify still mints a session under the enabled gate', async () => {
		const email = uniqueEmail();
		const code = await createOtp(email);

		await setGate({ enabled: true, emails: [email] });

		const res = await otpVerify({ email, code });

		expect(res.status).toBe(200);
		expect(res.headers.get('set-cookie')).toContain('vici_session=');
	});
});

describe.if(dbAvailable)('beta gate on the Google callback', () => {
	const savedGoogle = { ...env.google };

	beforeAll(async () => {
		await ensureMigrated();

		// The test env ships Google unconfigured; enable it in-memory so the
		// callback path runs (exchangeCode is mocked per test).
		Object.assign(env.google, {
			enabled: true,
			clientId: 'test-client',
			clientSecret: 'test-secret',
			redirectUri: ''
		});
	});

	afterAll(() => {
		Object.assign(env.google, savedGoogle);
	});

	beforeEach(() => {
		resetRateLimits();
	});

	afterEach(async () => {
		await clearGate();
	});

	const callback = async (profileEmail: string): Promise<Response> => {
		const exchange = spyOn(google, 'exchangeCode').mockResolvedValue({
			sub: `sub-${crypto.randomUUID()}`,
			email: profileEmail,
			name: 'Gate Test',
			emailVerified: true
		});

		try {
			const cookie = encodeOauthState({ state: 'csrf-ok', returnTo: '/' });

			return await app.handle(
				new Request('http://localhost/api/v1/auth/google/callback?code=c&state=csrf-ok', {
					headers: { cookie: `${OAUTH_STATE_COOKIE}=${cookie}` }
				})
			);
		} finally {
			exchange.mockRestore();
		}
	};

	test('non-allowlisted profile is bounced to the beta landing without a session', async () => {
		await setGate({ enabled: true, emails: [uniqueEmail()] });

		const res = await callback(uniqueEmail());

		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toBe(`${env.publicAppUrl}/?e=beta`);
		expect(res.headers.get('set-cookie')).not.toContain('vici_session=');
	});

	test('allowlisted profile logs in under the enabled gate', async () => {
		const email = uniqueEmail();

		await setGate({ enabled: true, emails: [email.toUpperCase()] });

		const res = await callback(email);

		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toBe(`${env.publicAppUrl}/`);
		expect(res.headers.get('set-cookie')).toContain('vici_session=');
	});

	test('gate off: callback logs in as before', async () => {
		const res = await callback(uniqueEmail());

		expect(res.status).toBe(302);
		expect(res.headers.get('set-cookie')).toContain('vici_session=');
	});
});
