// Email one-time-code flow. Single-use, 10-minute TTL, 5-attempt lockout,
// hashed at rest. The request route always responds identically whether or
// not the address is known, so the endpoint cannot be used as an oracle.

import { isNullish } from '@dfinity/utils';
import { query } from '../db/client';
import { constantTimeEqual, generateOtp, peppered } from '../lib/crypto';
import { sendOtpEmail } from '../lib/email';
import { logger } from '../lib/logger';
import { normalizeEmail, resolveIdentity } from './identity';

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

interface OtpRow {
	id: string;
	code_hash: string;
	attempts: number;
}

/** Store a fresh code for the address; the plaintext code (for delivery).
 * Exported separately from `requestOtp` so tests can drive the verify path
 * without intercepting email. */
export const createOtp = async (email: string): Promise<string> => {
	const e = normalizeEmail(email);
	const code = generateOtp();
	const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

	// Opportunistic cleanup of expired codes for this address.
	await query(`delete from otp_codes where lower(email) = $1 and expires_at <= now()`, [e]);

	await query(`insert into otp_codes (email, code_hash, expires_at) values ($1, $2, $3)`, [
		e,
		peppered(code),
		expiresAt
	]);

	return code;
};

/** Issue and deliver a code. Delivery failures are logged server-side and
 * never change the route response, so the response stays identical for every
 * address. */
export const requestOtp = async (email: string): Promise<void> => {
	const e = normalizeEmail(email);
	const code = await createOtp(e);

	try {
		await sendOtpEmail(e, code);
	} catch (err) {
		logger.error(`[otp] delivery failed for ${e}:`, err);
	}
};

export type VerifyResult =
	{ ok: true; userId: string } | { ok: false; reason: 'invalid' | 'locked' };

/** Verify a code. Success resolves (or provisions) the user for the verified
 * address and burns every outstanding code for it (single-use). Wrong codes
 * increment the attempt counter; OTP_MAX_ATTEMPTS locks the code out even for
 * the right code afterwards. */
export const verifyOtp = async ({
	email,
	code
}: {
	email: string;
	code: string;
}): Promise<VerifyResult> => {
	const e = normalizeEmail(email);

	const rows = await query<OtpRow>(
		`select id, code_hash, attempts from otp_codes
		 where lower(email) = $1 and expires_at > now()
		 order by created_at desc limit 1`,
		[e]
	);
	const [otp] = rows;

	if (isNullish(otp)) {
		return { ok: false, reason: 'invalid' };
	}

	if (otp.attempts >= OTP_MAX_ATTEMPTS) {
		return { ok: false, reason: 'locked' };
	}

	if (!constantTimeEqual(otp.code_hash, peppered(code))) {
		await query(`update otp_codes set attempts = attempts + 1 where id = $1`, [otp.id]);

		return { ok: false, reason: 'invalid' };
	}

	await query(`delete from otp_codes where lower(email) = $1`, [e]);

	const userId = await resolveIdentity({ provider: 'email', subject: e, email: e });

	return { ok: true, userId };
};
