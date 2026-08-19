// Identity resolution: map a freshly verified provider identity to a user,
// provisioning on first sign-in and linking new providers to an existing
// account by verified email. Every caller must only pass identities whose
// email ownership has been proven (OTP-verified or provider-asserted).
//
// The legacy auto-match runs after resolution: an account with no
// legacy_principals link yet is matched against the exported legacy identity
// table by email, so on-chain history follows the user to this stack without
// any manual claim step.

import { isNullish, nonNullish } from '@dfinity/utils';
import { tx, type TxQuery } from '../db/client';

export type Provider = 'google' | 'apple' | 'email';

export interface VerifiedIdentity {
	provider: Provider;
	subject: string;
	email: string;
	displayName?: string;
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const linkLegacyPrincipals = async ({
	q,
	userId,
	email
}: {
	q: TxQuery;
	userId: string;
	email: string;
}): Promise<void> => {
	const linked = await q<{ principal: string }>(
		`select principal from legacy_principals where user_id = $1 limit 1`,
		[userId]
	);

	if (nonNullish(linked[0])) {
		return;
	}

	// Provider-asserted addresses first: an openid email was verified by the
	// legacy identity provider, a profile email was merely self-reported.
	// `on conflict do nothing` keeps a principal already claimed by another
	// account (or by the openid pass) untouched.
	await q(
		`insert into legacy_principals (principal, user_id, matched_via)
		 select principal, $1, 'openid_email'
		 from legacy_auth_identities
		 where lower(openid_email) = $2
		 on conflict (principal) do nothing`,
		[userId, email]
	);

	await q(
		`insert into legacy_principals (principal, user_id, matched_via)
		 select principal, $1, 'profile_email'
		 from legacy_auth_identities
		 where lower(profile_email) = $2
		 on conflict (principal) do nothing`,
		[userId, email]
	);
};

/** Resolve (or provision) the user behind a verified identity; the user id.
 * Runs in one transaction so a concurrent first login cannot double-provision. */
export const resolveIdentity = (identity: VerifiedIdentity): Promise<string> => {
	const email = normalizeEmail(identity.email);
	const displayName = identity.displayName?.trim() ?? '';

	return tx(async (q) => {
		const bySubject = await q<{ user_id: string }>(
			`select user_id from auth_identities where provider = $1 and subject = $2`,
			[identity.provider, identity.subject]
		);
		let userId = bySubject[0]?.user_id;

		if (isNullish(userId)) {
			// A verified email proves ownership, so a new provider attaches to the
			// account that already holds that address under another provider.
			const byEmail = await q<{ user_id: string }>(
				`select user_id from auth_identities where lower(email) = $1 limit 1`,
				[email]
			);

			userId = byEmail[0]?.user_id;

			if (isNullish(userId)) {
				const inserted = await q<{ id: string }>(
					`insert into users (display_name) values ($1) returning id`,
					[displayName === '' ? null : displayName]
				);
				const insertedId = inserted[0]?.id;

				if (isNullish(insertedId)) {
					throw new Error('user insert returned no row');
				}

				userId = insertedId;
			}

			await q(
				`insert into auth_identities (user_id, provider, subject, email)
				 values ($1, $2, $3, $4)`,
				[userId, identity.provider, identity.subject, email]
			);
		}

		await linkLegacyPrincipals({ q, userId, email });

		return userId;
	});
};
