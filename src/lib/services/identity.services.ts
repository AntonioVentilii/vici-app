import { isNullish } from '@dfinity/utils';
import type { Identity } from '@icp-sdk/core/agent';
import { getIdentityOnce } from '@junobuild/core';

export const safeGetIdentityOnce = async (): Promise<Identity> => {
	const identity = await getIdentityOnce();

	if (isNullish(identity)) {
		throw new Error('Not authenticated');
	}

	return identity;
};
