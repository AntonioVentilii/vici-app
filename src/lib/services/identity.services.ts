import { isNullish } from '@dfinity/utils';
import { AnonymousIdentity, type Identity } from '@icp-sdk/core/agent';
import { getIdentityOnce } from '@junobuild/core';

/**
 * Juno-backed sign-in: current ICP identity, or null/undefined if signed out.
 */
export const getIdentity = async (): Promise<Identity | undefined | null> =>
	await getIdentityOnce();

/**
 * Same as {@link getIdentity}, but falls back to `AnonymousIdentity` for public reads.
 */
export const getIdentityOrAnonymous = async (): Promise<Identity> => {
	const identity = await getIdentity();

	return identity ?? new AnonymousIdentity();
};

/**
 * Returns the signed-in identity or throws if the user is not authenticated.
 */
export const safeGetIdentityOnce = async (): Promise<Identity> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		throw new Error('Not authenticated');
	}

	return identity;
};
